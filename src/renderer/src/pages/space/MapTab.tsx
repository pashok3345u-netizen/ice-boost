import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, ChevronRight, CircleStop, FolderOpen, Lock, Map as MapIcon, Radar, RefreshCw, Trash2 } from 'lucide-react'
import type { MapItem, MapLevel } from '../../../../shared/types'
import { fileKind, lockReason } from '../../../../shared/space'
import { useStore } from '../../store'
import { useProgress } from '../../progress'
import { useSpace } from '../../space'
import { mapHint } from '../../catalog'
import { Button, Card, Modal, cx } from '../../ui'
import { errText, fmtAgo, fmtBytes } from '../../format'
import { burst } from '../../Fx'
import { Treemap, type Tile } from './Treemap'
import { KIND_ICON } from './FilesTab'
import { ScanLine } from './bits'

// folders in teal shades, files frost, "small stuff" and "hidden" dark
const DIR_COLORS = ['#528A9A', '#467B89', '#5E97A7', '#3D6B77', '#6AA3B2', '#4F8696', '#7DB4C2', '#38606B']
const FILE_COLORS = ['#B9D3D7', '#A6C4C9', '#C9DDDF']
const MAX_TILES = 60

interface View extends MapItem {
  key: string
  color: string
  light: boolean
  lock: ReturnType<typeof lockReason>
  hint: string | null
}

export function MapTab(): ReactNode {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const fmt = (v: number): string => fmtBytes(v, lang)
  const { toast, go } = useStore()
  const { track } = useProgress()
  const s = useSpace()
  const drive = s.goal.drive
  const d = s.drives?.find((x) => x.root === drive)
  const st = s.status?.map
  const scanning = !!st?.running
  const ready = s.map && s.map.root === drive ? s.map : null
  const [level, setLevel] = useState<MapLevel | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [confirm, setConfirm] = useState<View | null>(null)
  const cache = useRef(new Map<string, MapLevel>())

  useEffect(() => {
    cache.current = new Map()
    if (ready) {
      cache.current.set(ready.level.path.toLowerCase(), ready.level)
      setLevel(ready.level)
    } else setLevel(null)
  }, [ready])

  const appDirs = useMemo(() => (s.apps ?? []).map((a) => a.location).filter((x): x is string => !!x), [s.apps])

  const open = async (path: string): Promise<void> => {
    const key = path.toLowerCase()
    const lv = cache.current.get(key) ?? (await window.api.mapLevel(path).catch(() => null))
    if (!lv) return
    cache.current.set(key, lv)
    setLevel(lv)
    setHover(null)
    setShowAll(false)
  }

  const views = useMemo<View[]>(() => {
    if (!level) return []
    const items: MapItem[] = [...level.items]
    // at the drive root: the space Windows uses but nobody can list (restore points, no-access folders)
    if (d && level.path.toLowerCase() === drive.toLowerCase()) {
      const hidden = d.total - d.free - level.size
      if (hidden > d.total * 0.003) items.push({ name: '', path: `${drive}\\?hidden`, size: hidden, files: 0, dir: false, special: 'hidden' })
      items.sort((a, b) => b.size - a.size)
    }
    let di = 0
    let fi = 0
    return items.map((it) => {
      const color = it.special
        ? it.special === 'hidden' ? '#2E2E36' : '#3D3D47'
        : it.dir ? DIR_COLORS[di++ % DIR_COLORS.length] : FILE_COLORS[fi++ % FILE_COLORS.length]
      return {
        ...it,
        key: it.path,
        color,
        light: !it.dir && !it.special,
        lock: it.special || !s.places ? null : lockReason(it.path, s.places, appDirs),
        hint: it.special ? null : mapHint(it.path)
      }
    })
  }, [level, d, drive, s.places, appDirs])

  const label = (v: View): string => (v.special === 'other' ? t('space.map.other') : v.special === 'hidden' ? t('space.map.hidden') : v.name)
  const tiles = useMemo<Tile[]>(() => {
    const top = views.slice(0, MAX_TILES)
    const rest = views.slice(MAX_TILES)
    const list: Tile[] = top.map((v) => ({
      key: v.key,
      size: v.size,
      label: label(v),
      sub: fmt(v.size),
      color: v.color,
      light: v.light,
      striped: v.special === 'hidden',
      locked: !!v.lock,
      clickable: v.dir && !v.denied
    }))
    if (rest.length) {
      const size = rest.reduce((a, v) => a + v.size, 0)
      list.push({ key: '?rest', size, label: t('space.map.other'), sub: fmt(size), color: '#3D3D47' })
    }
    return list
  }, [views, t, lang])

  const crumbs = useMemo(() => {
    if (!level) return []
    const parts = level.path.split('\\')
    return parts.map((p, i) => ({ name: p, path: parts.slice(0, i + 1).join('\\') }))
  }, [level])

  const trash = async (v: View): Promise<void> => {
    setConfirm(null)
    try {
      const r = await window.api.trashPaths([v.path])
      if (r.moved) {
        burst({})
        toast(t('space.files.moved', { n: 1, size: fmt(r.size) }), 'info')
        track({ type: 'trash', count: 1, old: 0 })
        s.setBinHint(true)
        void s.refreshExtras()
        // take it off the map right away (parents are measured again on the next check)
        setLevel((lv) => (lv ? { ...lv, size: lv.size - v.size, items: lv.items.filter((x) => x.path !== v.path) } : lv))
        cache.current.clear()
      } else if (r.refused.length) toast(t('space.files.refused', { n: 1 }), 'err')
      else toast(t('space.un.failed'), 'err')
    } catch (e) {
      toast(errText(e, t('common.uacDenied')), 'err')
    }
  }

  if (!ready) {
    return (
      <Card className="relative overflow-hidden py-10 text-center">
        <div className="pointer-events-none absolute -top-24 left-1/2 size-72 -translate-x-1/2 rounded-full bg-teal/25 blur-3xl" />
        <motion.div
          className="accent-gradient relative mx-auto grid size-16 place-items-center rounded-2xl text-[#1a1a1f]"
          animate={scanning ? { rotate: 360 } : { rotate: 0 }}
          transition={scanning ? { duration: 2.4, repeat: Infinity, ease: 'linear' } : {}}
        >
          {scanning ? <Radar className="size-8" /> : <MapIcon className="size-8" />}
        </motion.div>
        <h3 className="font-display relative mt-4 text-lg font-semibold">{t('space.map.introTitle')}</h3>
        <p className="relative mx-auto mt-1 max-w-md text-sm text-muted">{t('space.map.intro', { drive })}</p>
        <div className="relative mx-auto mt-5 max-w-lg">
          {scanning && st ? (
            <>
              <ScanLine text={t('space.map.scanning', { drive, n: st.files.toLocaleString(lang) })} sub={st.current} progress={0} />
              <Button size="sm" variant="ghost" icon={<CircleStop className="size-3.5" />} onClick={() => void window.api.cancelScan()}>
                {t('space.map.stop')}
              </Button>
            </>
          ) : (
            <Button variant="primary" size="lg" icon={<Radar className="size-5" />} disabled={!drive} onClick={() => void s.scanMap(drive)}>
              {t('space.map.scan', { drive })}
            </Button>
          )}
          {s.failed.map && <p className="mt-3 text-xs text-bad">{s.failed.map}</p>}
        </div>
      </Card>
    )
  }

  const listed = showAll ? views : views.slice(0, 12)
  const active = views.find((v) => v.key === hover) ?? null

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="ghost" icon={<ArrowLeft className="size-3.5" />} disabled={crumbs.length < 2} onClick={() => void open(crumbs[crumbs.length - 2].path)}>
          {t('space.map.back')}
        </Button>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-0.5 text-sm">
          {crumbs.map((c, i) => (
            <span key={c.path} className="flex items-center">
              {i > 0 && <ChevronRight className="size-3.5 text-muted/60" />}
              <button
                onClick={() => void open(c.path)}
                className={cx('rounded-md px-1.5 py-0.5 transition-colors', i === crumbs.length - 1 ? 'font-medium text-frost' : 'text-muted hover:bg-panel2 hover:text-text')}
              >
                {c.name}
              </button>
            </span>
          ))}
        </div>
        <span className="text-xs text-muted">{t('space.map.scannedAt', { ago: fmtAgo(ready.at, lang) })}</span>
        <Button size="sm" variant="ghost" icon={<RefreshCw className={cx('size-3.5', scanning && 'animate-spin')} />} disabled={scanning} onClick={() => void s.scanMap(drive)}>
          {t('space.map.rescan')}
        </Button>
      </div>

      <AnimatePresence>
        {scanning && st && <ScanLine text={t('space.map.scanning', { drive, n: st.files.toLocaleString(lang) })} sub={st.current} progress={0} />}
      </AnimatePresence>

      <div className="grid grid-cols-[minmax(0,1fr)_330px] gap-4">
        <Card className="p-2">
          {level && (
            <Treemap
              tiles={tiles}
              height={460}
              levelKey={level.path}
              active={hover}
              onHover={setHover}
              onPick={(key) => void open(key)}
            />
          )}
          <div className="flex h-9 items-center gap-2 px-2 pt-2 text-xs text-muted">
            {active ? (
              <>
                <span className="size-2.5 rounded-sm" style={{ background: active.color }} />
                <span className="truncate font-medium text-text">{label(active)}</span>
                <span className="tabular-nums">{fmt(active.size)}</span>
                {level && level.size > 0 && <span>· {t('space.map.share', { p: Math.round((active.size / level.size) * 100) })}</span>}
                {active.files > 1 && <span>· {t('space.map.files', { n: active.files.toLocaleString(lang) })}</span>}
              </>
            ) : (
              <span>{t('space.map.tip')}</span>
            )}
          </div>
        </Card>

        <Card className="flex max-h-[520px] flex-col p-0">
          <div className="flex items-baseline justify-between border-b border-line/60 px-4 py-3">
            <span className="font-display truncate text-sm font-semibold">{crumbs[crumbs.length - 1]?.name}</span>
            <span className="font-display text-sm tabular-nums text-ice">{level && fmt(level.size)}</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {listed.map((v) => (
              <div
                key={v.key}
                onMouseEnter={() => setHover(v.key)}
                className={cx('group border-b border-line/40 px-3 py-2 last:border-0', hover === v.key && 'bg-panel2/70')}
              >
                <div className="flex items-center gap-2">
                  <span className="size-2.5 shrink-0 rounded-sm" style={{ background: v.color }} />
                  {!v.dir && !v.special && <span className="text-muted">{KIND_ICON[fileKind(v.path)]}</span>}
                  <button
                    disabled={!v.dir || v.denied}
                    onClick={() => void open(v.path)}
                    className={cx('min-w-0 flex-1 truncate text-left text-sm', v.dir && !v.denied && 'hover:text-ice')}
                    title={v.special === 'hidden' ? t('space.map.hiddenHint') : v.path}
                  >
                    {label(v)}
                  </button>
                  <span className="text-xs tabular-nums">{fmt(v.size)}</span>
                </div>
                <div className="mt-0.5 flex items-center gap-2 pl-4.5">
                  <span className="min-w-0 flex-1 truncate text-[11px] text-muted/80">
                    {v.hint
                      ? t(`space.map.hint.${v.hint}`)
                      : v.special === 'hidden'
                        ? t('space.map.hiddenHint')
                        : v.denied
                          ? t('space.map.denied')
                          : v.lock
                            ? t(`space.map.lock.${v.lock}`)
                            : v.files > 1
                              ? t('space.map.files', { n: v.files.toLocaleString(lang) })
                              : ''}
                  </span>
                  {!v.special && (
                    <span className="flex shrink-0 gap-0.5 opacity-60 transition-opacity group-hover:opacity-100">
                      {v.hint === 'hiberfil' && (
                        <button className="rounded px-1.5 text-[11px] text-ice hover:bg-panel2" onClick={() => go('boost')}>
                          {t('space.wins.hiberfil.a')}
                        </button>
                      )}
                      <button className="grid size-6 place-items-center rounded text-muted hover:bg-panel2 hover:text-ice" title={t('space.map.open')} onClick={() => void window.api.showInFolder(v.path)}>
                        <FolderOpen className="size-3.5" />
                      </button>
                      {v.lock ? (
                        <span className="grid size-6 place-items-center text-muted/60" title={t(`space.map.lock.${v.lock}`)}>
                          <Lock className="size-3.5" />
                        </span>
                      ) : (
                        <button className="grid size-6 place-items-center rounded text-muted hover:bg-bad/15 hover:text-bad" title={t('space.map.trash')} onClick={() => setConfirm(v)}>
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </span>
                  )}
                </div>
              </div>
            ))}
            {views.length > 12 && !showAll && (
              <button className="w-full py-2.5 text-xs text-ice hover:bg-panel2/60" onClick={() => setShowAll(true)}>
                {t('space.files.more', { n: views.length - 12 })}
              </button>
            )}
          </div>
        </Card>
      </div>

      <Modal open={!!confirm} onClose={() => setConfirm(null)}>
        <h3 className="font-display text-lg font-semibold">{t('space.files.confirmTitle')}</h3>
        <p className="mt-2 text-sm text-muted">{confirm && t('space.map.confirm', { name: confirm.name, size: fmt(confirm.size) })}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirm(null)}>
            {t('common.cancel')}
          </Button>
          <Button variant="danger" icon={<Trash2 className="size-4" />} onClick={() => confirm && void trash(confirm)}>
            {t('space.map.trash')}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
