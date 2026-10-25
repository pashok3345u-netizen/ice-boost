import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion } from 'motion/react'
import {
  Archive, Cloud, Copy, Disc3, File, FileText, Film, FolderOpen, FolderPlus, Image, Info, Music, Package, RefreshCw, ShieldCheck, Trash2, X
} from 'lucide-react'
import type { BigFile } from '../../../../shared/types'
import { fileKind, isInside, type FileKind } from '../../../../shared/space'
import { useStore } from '../../store'
import { useProgress } from '../../progress'
import { GB, MB, useSpace, type FileMode } from '../../space'
import { Button, Card, Checkbox, Modal, Skeleton, cx } from '../../ui'
import { daysSince, errText, fmtBytes, fmtSpan } from '../../format'
import { burst } from '../../Fx'
import { Chip, ScanLine, SelectionBar } from './bits'

const COLS = 'grid grid-cols-[20px_30px_minmax(0,1fr)_150px_86px_32px] items-center gap-3'
const MODES: FileMode[] = ['old', 'big', 'copies']
const AGES = [30, 90, 180, 365, 730]
const SIZES = [10 * MB, 100 * MB, GB]
const KINDS: (FileKind | 'all')[] = ['all', 'video', 'archive', 'installer', 'disk', 'audio', 'image', 'doc', 'other']

export const KIND_ICON: Record<FileKind, ReactNode> = {
  video: <Film className="size-4" />,
  archive: <Archive className="size-4" />,
  installer: <Package className="size-4" />,
  disk: <Disc3 className="size-4" />,
  audio: <Music className="size-4" />,
  image: <Image className="size-4" />,
  doc: <FileText className="size-4" />,
  other: <File className="size-4" />
}

const fileName = (p: string): string => p.slice(p.lastIndexOf('\\') + 1)
const folderOf = (p: string): string => p.slice(0, p.lastIndexOf('\\'))

export function FilesTab(): ReactNode {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const fmt = (v: number): string => fmtBytes(v, lang)
  const { toast } = useStore()
  const { track } = useProgress()
  const s = useSpace()
  const v = s.fileView
  const set = (p: Partial<typeof v>): void => s.setFileView({ ...v, ...p })
  const [limit, setLimit] = useState(150)
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const st = s.status?.files
  const scanning = !!st?.running
  const access = s.files?.accessTime ?? true

  const sized = useMemo(() => (s.files?.files ?? []).filter((f) => f.size >= v.minSize), [s.files, v.minSize])
  const inMode = useMemo(() => {
    if (v.mode === 'old') return sized.filter((f) => daysSince(f.lastUsed) >= v.age)
    if (v.mode === 'big') return sized
    // copies: only groups that still have 2+ files
    const n = new Map<string, number>()
    for (const f of sized) if (f.copyOf) n.set(f.copyOf, (n.get(f.copyOf) ?? 0) + 1)
    return sized.filter((f) => f.copyOf && (n.get(f.copyOf) ?? 0) > 1)
  }, [sized, v.mode, v.age])

  const kindSizes = useMemo(() => {
    const m: Partial<Record<FileKind | 'all', number>> = { all: 0 }
    for (const f of inMode) {
      const k = fileKind(f.path)
      m[k] = (m[k] ?? 0) + f.size
      m.all! += f.size
    }
    return m
  }, [inMode])

  const list = useMemo(
    () => (v.kind === 'all' ? inMode : inMode.filter((f) => fileKind(f.path) === v.kind)).slice().sort((a, b) => b.size - a.size),
    [inMode, v.kind]
  )
  const groups = useMemo(() => {
    if (v.mode !== 'copies') return []
    const m = new Map<string, BigFile[]>()
    for (const f of list) m.set(f.copyOf!, [...(m.get(f.copyOf!) ?? []), f])
    return [...m.values()].filter((g) => g.length > 1).sort((a, b) => b[0].size * (b.length - 1) - a[0].size * (a.length - 1))
  }, [list, v.mode])

  const byPath = useMemo(() => new Map((s.files?.files ?? []).map((f) => [f.path, f])), [s.files])
  const picked = [...s.selFiles].map((p) => byPath.get(p)).filter((f): f is BigFile => !!f)
  const pickedSize = picked.reduce((a, f) => a + f.size, 0)
  const toggle = (path: string, on: boolean): void => {
    const n = new Set(s.selFiles)
    if (on) n.add(path)
    else n.delete(path)
    s.setSelFiles(n)
  }
  // keep the oldest file of each group — it's most likely the original
  const pickCopies = (): void => {
    const n = new Set(s.selFiles)
    for (const g of groups) {
      const keep = g.reduce((a, b) => (b.modified < a.modified ? b : a))
      for (const f of g) if (f !== keep) n.add(f.path)
    }
    s.setSelFiles(n)
  }

  const trash = async (): Promise<void> => {
    setConfirm(false)
    setBusy(true)
    try {
      const r = await window.api.trashPaths(picked.map((f) => f.path))
      const moved = new Set(r.movedPaths)
      const old = picked.filter((f) => moved.has(f.path) && daysSince(f.lastUsed) > 365).length
      s.dropFiles(r.movedPaths)
      if (r.moved > 0) {
        track({ type: 'trash', count: r.moved, old })
        burst({})
        toast(t('space.files.moved', { n: r.moved, size: fmt(r.size) }), 'info')
        s.setBinHint(true)
        void s.refreshExtras()
      }
      if (r.refused.length) toast(t('space.files.refused', { n: r.refused.length }), 'err')
    } catch (e) {
      toast(errText(e, t('common.uacDenied')), 'err')
    } finally {
      setBusy(false)
    }
  }

  const age = (f: BigFile): string =>
    t(access ? 'space.files.untouched' : 'space.files.unchanged', { span: fmtSpan(f.lastUsed, lang) })

  const oneDrive = s.places?.oneDrive ?? []
  const row = (f: BigFile, i: number): ReactNode => {
    const sel = s.selFiles.has(f.path)
    const kind = fileKind(f.path)
    const cloud = oneDrive.some((o) => isInside(f.path, o))
    return (
      <motion.div
        key={f.path}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: Math.min(i, 14) * 0.015 }}
        className={cx(COLS, 'border-b border-line/50 px-4 py-2 last:border-0', sel ? 'bg-teal/10' : 'hover:bg-panel2/60')}
      >
        <Checkbox checked={sel} onChange={(on) => toggle(f.path, on)} />
        <span className="grid size-7.5 place-items-center rounded-lg bg-teal/15 text-ice">{KIND_ICON[kind]}</span>
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm" title={f.path}>
              {fileName(f.path)}
            </span>
            {cloud && (
              <span title={t('space.files.oneDriveHint')}>
                <Cloud className="size-3.5 shrink-0 text-ice" />
              </span>
            )}
          </div>
          <div className="truncate text-[11px] text-muted/80" title={folderOf(f.path)}>
            {folderOf(f.path)}
          </div>
        </div>
        <span className={cx('text-xs', daysSince(f.lastUsed) > 365 ? 'text-warn' : 'text-muted')}>{age(f)}</span>
        <span className={cx('font-display text-right text-sm font-semibold tabular-nums', f.size >= GB && 'text-ice')}>{fmt(f.size)}</span>
        <button className="grid size-8 place-items-center rounded-lg text-muted hover:bg-panel2 hover:text-ice" title={t('space.files.show')} onClick={() => void window.api.showInFolder(f.path)}>
          <FolderOpen className="size-4" />
        </button>
      </motion.div>
    )
  }

  const empty = v.mode === 'old' ? 'emptyOld' : v.mode === 'big' ? 'emptyBig' : 'emptyCopies'

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {MODES.map((m) => (
          <Chip key={m} active={v.mode === m} onClick={() => set({ mode: m })} icon={m === 'copies' ? <Copy className="size-3.5" /> : undefined}>
            {t(`space.files.mode.${m}`)}
          </Chip>
        ))}
        <span className="flex-1" />
        {v.mode === 'old' && (
          <label className="flex items-center gap-2 text-xs text-muted">
            {t('space.files.olderThan')}
            <select
              value={v.age}
              onChange={(e) => set({ age: Number(e.target.value) })}
              className="h-9 rounded-lg border border-line bg-panel2 px-2 text-sm text-text outline-none focus:border-teal/70"
            >
              {AGES.map((a) => (
                <option key={a} value={a}>
                  {t(`space.files.ages.a${a}`)}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="flex items-center gap-2 text-xs text-muted">
          {t('space.files.minSize')}
          <select
            value={v.minSize}
            onChange={(e) => set({ minSize: Number(e.target.value) })}
            className="h-9 rounded-lg border border-line bg-panel2 px-2 text-sm text-text outline-none focus:border-teal/70"
          >
            {SIZES.map((x) => (
              <option key={x} value={x}>
                {fmt(x)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className={cx('mb-3 flex-wrap gap-1.5', inMode.length ? 'flex' : 'hidden')}>
        {KINDS.filter((k) => k === 'all' || kindSizes[k]).map((k) => (
          <button
            key={k}
            onClick={() => set({ kind: k })}
            className={cx(
              'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition-colors',
              v.kind === k ? 'border-teal/60 bg-teal/20 text-frost' : 'border-line bg-panel2/60 text-muted hover:text-text'
            )}
          >
            {k !== 'all' && KIND_ICON[k]}
            {t(`space.files.kinds.${k}`)}
            <span className="text-muted/80 tabular-nums">{fmt(kindSizes[k] ?? 0)}</span>
          </button>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted">
        <span>{t('space.files.where')}</span>
        {s.extraRoots.map((r) => (
          <span key={r} className="inline-flex items-center gap-1 rounded-md border border-line bg-panel2/60 py-0.5 pr-1 pl-2 font-mono text-[11px]">
            {r}
            <button className="rounded p-0.5 hover:bg-bad/20 hover:text-bad" onClick={() => s.removeRoot(r)}>
              <X className="size-3" />
            </button>
          </span>
        ))}
        <Button size="sm" variant="ghost" icon={<FolderPlus className="size-3.5" />} disabled={scanning} onClick={() => void s.addRoot()}>
          {t('space.files.addFolder')}
        </Button>
        <span className="flex-1" />
        {s.files && !scanning && <span>{t('space.files.scanned', { n: s.files.scanned.toLocaleString(lang) })}</span>}
        <Button size="sm" variant="ghost" icon={<RefreshCw className={cx('size-3.5', scanning && 'animate-spin')} />} disabled={scanning} onClick={() => void s.refreshFiles()}>
          {t('space.files.rescan')}
        </Button>
      </div>

      {s.files && s.files.inApps.files > 0 && (
        <div className="mb-2 flex items-center gap-2 text-xs text-muted">
          <ShieldCheck className="size-3.5 text-good" />
          {t('space.files.inApps', { n: s.files.inApps.files, size: fmt(s.files.inApps.size) })}
        </div>
      )}
      {s.files && !s.files.accessTime && (
        <div className="mb-3 flex items-center gap-2 text-xs text-muted">
          <Info className="size-3.5 text-ice" />
          {t('space.files.noAccess')}
        </div>
      )}

      <AnimatePresence>
        {scanning && st && (
          <ScanLine
            text={
              st.phase === 'compare'
                ? t('space.files.comparing', { done: st.done, total: st.total })
                : t('space.files.scanning', { n: st.files.toLocaleString(lang) })
            }
            sub={st.current}
            progress={st.phase === 'compare' && st.total ? st.done / st.total : 0}
          />
        )}
      </AnimatePresence>

      {!s.files ? (
        <Card className="space-y-2 p-4">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-11" />
          ))}
        </Card>
      ) : list.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted">{t(`space.files.${empty}`)}</Card>
      ) : v.mode === 'copies' ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Button size="sm" icon={<Copy className="size-3.5" />} onClick={pickCopies}>
              {t('space.files.pickCopies')}
            </Button>
            <span className="text-xs text-muted">{t('space.files.pickCopiesHint')}</span>
          </div>
          {groups.slice(0, limit).map((g) => (
            <Card key={g[0].copyOf} className="p-0">
              <div className="border-b border-line/60 px-4 py-2 text-xs text-muted">
                {t('space.files.copyGroup', { n: g.length, size: fmt(g[0].size * (g.length - 1)) })}
              </div>
              {g.map((f, i) => row(f, i))}
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-0">{list.slice(0, limit).map((f, i) => row(f, i))}</Card>
      )}

      {(v.mode === 'copies' ? groups.length : list.length) > limit && (
        <div className="mt-3 text-center">
          <Button size="sm" variant="ghost" onClick={() => setLimit(limit + 150)}>
            {t('space.files.more', { n: (v.mode === 'copies' ? groups.length : list.length) - limit })}
          </Button>
        </div>
      )}

      <SelectionBar
        open={picked.length > 0}
        busy={busy}
        text={t('space.files.selected', { n: picked.length, size: fmt(pickedSize) })}
        clearText={t('space.apps.clear')}
        actionText={t('space.files.toTrash')}
        onClear={() => s.setSelFiles(new Set())}
        onAction={() => setConfirm(true)}
      />

      <Modal open={confirm} onClose={() => setConfirm(false)}>
        <h3 className="font-display text-lg font-semibold">{t('space.files.confirmTitle')}</h3>
        <p className="mt-2 text-sm text-muted">{t('space.files.confirm', { n: picked.length, size: fmt(pickedSize) })}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirm(false)}>
            {t('common.cancel')}
          </Button>
          <Button variant="danger" icon={<Trash2 className="size-4" />} onClick={() => void trash()}>
            {t('space.files.toTrash')}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
