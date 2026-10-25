// IceBoost disk engine. Compiled once by PowerShell (Add-Type), so: plain C# 5, no newer syntax.
// Walks folders with FindFirstFileEx (sizes come for free, no extra calls per file), runs long scans
// on a background thread so the app can ask for progress, and keeps the disk map tree in memory.
using System;
using System.Collections.Generic;
using System.IO;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Win32;

public static class IceSpace {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  struct FindData {
    public uint attrs;
    public uint cLo, cHi, aLo, aHi, wLo, wHi;
    public uint sizeHi, sizeLo;
    public uint r0, r1;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)] public string name;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 14)] public string alt;
  }

  [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
  static extern IntPtr FindFirstFileExW(string name, int level, out FindData data, int op, IntPtr filter, int flags);
  [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
  static extern bool FindNextFileW(IntPtr h, out FindData data);
  [DllImport("kernel32.dll")]
  static extern bool FindClose(IntPtr h);
  [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
  static extern uint QueryDosDeviceW(string name, StringBuilder target, int max);

  static readonly IntPtr BAD = new IntPtr(-1);
  const uint DIR = 0x10, REPARSE = 0x400, OFFLINE = 0x1000, RECALL_OPEN = 0x40000, RECALL_DATA = 0x400000;
  const uint CLOUD = OFFLINE | RECALL_OPEN | RECALL_DATA;
  // reparse tag bit of junctions and symlinks ("this name stands for another place")
  const uint NAME_SURROGATE = 0x20000000;
  static readonly DateTime Epoch = new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc);

  // the map keeps folders from 1 MB and the 30 biggest files of every folder; the rest is summed up
  const long KEEP_DIR = 1L << 20;
  const int TOP_FILES = 30;
  // copies: files up to 256 MB are compared fully, bigger ones by 32 pieces of 1 MB
  const long FULL_HASH = 256L << 20;

  // ---------------------------------------------------------------- background job

  static volatile bool running, cancel;
  static volatile int done, total;
  static long seen;
  static volatile string current = "", phase = "";
  static string result, error;

  static void Start(Func<string> work) {
    if (running) throw new InvalidOperationException("busy");
    cancel = false; done = 0; total = 0; seen = 0; current = ""; phase = "";
    result = null; error = null; running = true;
    Thread t = new Thread(delegate() {
      try { result = work(); } catch (Exception e) { error = e.Message; } finally { running = false; }
    });
    t.IsBackground = true;
    t.Start();
  }

  public static string Status() {
    return "{\"running\":" + (running ? "true" : "false") + ",\"done\":" + done + ",\"total\":" + total +
      ",\"files\":" + Interlocked.Read(ref seen) + ",\"current\":" + Str(current) + ",\"phase\":" + Str(phase) +
      ",\"error\":" + (error == null ? "null" : Str(error)) + "}";
  }

  public static string Result() {
    string r = result;
    result = null;
    return r ?? "null";
  }

  public static void Cancel() { cancel = true; }

  // ---------------------------------------------------------------- walking

  public class Node {
    public string name;
    public long size, files, otherSize, otherFiles;
    public bool denied;
    public List<Node> dirs = new List<Node>();
    public List<KeyValuePair<string, long>> top = new List<KeyValuePair<string, long>>();
  }

  class Hit {
    public string path, hash;
    public long size, write, create, access;
    /** lies in a program's folder (an .exe next to .dll files) — deleting it would break the program */
    public bool app;
  }

  class Ctx {
    public HashSet<string> skip = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
    public HashSet<string> skipNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
    public bool skipDot, parallel;
    public long minFile = long.MaxValue;
    public List<Hit> hits;
    /** program files found (full path), with how deep they are — the app's main exe is usually near the top */
    public List<KeyValuePair<int, string>> exes;
  }

  static string Norm(string p) {
    p = p.Replace('/', '\\');
    while (p.Length > 2 && p.EndsWith("\\")) p = p.Substring(0, p.Length - 1);
    if (p.Length == 3 && p[1] == ':' && p[2] == '\\') p = p.Substring(0, 2);
    return p;
  }

  static long Ms(uint lo, uint hi) {
    long ft = ((long)hi << 32) | lo;
    return FtMs(ft);
  }

  static long FtMs(long ft) {
    if (ft <= 0) return 0;
    try { return (long)(DateTime.FromFileTimeUtc(ft) - Epoch).TotalMilliseconds; } catch { return 0; }
  }

  /**
   * Total size of a folder. `node` != null builds the disk map tree.
   * `inApp` = some parent folder is a program's folder.
   */
  static long Walk(string dir, Ctx c, Node node, int depth, bool inApp) {
    if (cancel) return 0;
    FindData d;
    IntPtr h = FindFirstFileExW(@"\\?\" + dir + @"\*", 1, out d, 0, IntPtr.Zero, 2);
    if (h == BAD) {
      if (node != null) node.denied = true;
      return 0;
    }
    long sum = 0;
    List<string> subs = new List<string>();
    List<Hit> mine = c.hits != null ? new List<Hit>() : null;
    bool hasExe = false, hasDll = false;
    List<KeyValuePair<string, long>> files = node != null ? new List<KeyValuePair<string, long>>() : null;
    try {
      do {
        string name = d.name;
        // junctions and symlinks point somewhere else (would count twice or loop forever).
        // OneDrive files are reparse points too, but not "name surrogates", so they are counted.
        bool link = (d.attrs & REPARSE) != 0 && (d.r0 & NAME_SURROGATE) != 0;
        if ((d.attrs & DIR) != 0) {
          if (name == "." || name == ".." || link) continue;
          // a cloud folder that isn't on this PC yet — opening it would start a download
          if ((d.attrs & (OFFLINE | RECALL_OPEN)) != 0) continue;
          if (c.skipDot && name[0] == '.') continue;
          if (c.skipNames.Contains(name) || c.skip.Contains(dir + "\\" + name)) continue;
          subs.Add(name);
        } else {
          // only in the cloud (OneDrive "online-only") — takes no space on this disk
          if (link || (d.attrs & CLOUD) != 0) continue;
          long len = ((long)d.sizeHi << 32) | d.sizeLo;
          sum += len;
          long n = Interlocked.Increment(ref seen);
          if ((n & 511) == 0) current = dir;
          if (node != null) { node.files++; files.Add(new KeyValuePair<string, long>(name, len)); }
          if (name.EndsWith(".exe", StringComparison.OrdinalIgnoreCase)) hasExe = true;
          else if (name.EndsWith(".dll", StringComparison.OrdinalIgnoreCase)) hasDll = true;
          if (c.exes != null && c.exes.Count < 400 && name.EndsWith(".exe", StringComparison.OrdinalIgnoreCase)) c.exes.Add(new KeyValuePair<int, string>(depth, dir + "\\" + name));
          if (c.hits != null && len >= c.minFile) {
            Hit hit = new Hit();
            hit.path = dir + "\\" + name;
            hit.size = len;
            hit.write = Ms(d.wLo, d.wHi);
            hit.create = Ms(d.cLo, d.cHi);
            hit.access = Ms(d.aLo, d.aHi);
            mine.Add(hit);
          }
        }
      } while (FindNextFileW(h, out d));
    } finally {
      FindClose(h);
    }
    bool app = inApp || (hasExe && hasDll);
    if (mine != null && mine.Count > 0) {
      foreach (Hit hit in mine) hit.app = app;
      lock (c.hits) c.hits.AddRange(mine);
    }

    // the first two levels are walked by several threads at once: an SSD answers them in parallel
    Node[] kids = new Node[subs.Count];
    long[] sizes = new long[subs.Count];
    if (c.parallel && depth < 2 && subs.Count > 1) {
      ParallelOptions po = new ParallelOptions();
      po.MaxDegreeOfParallelism = 6;
      Parallel.For(0, subs.Count, po, delegate(int i) {
        kids[i] = node != null ? new Node() : null;
        sizes[i] = Walk(dir + "\\" + subs[i], c, kids[i], depth + 1, app);
      });
    } else {
      for (int i = 0; i < subs.Count; i++) {
        kids[i] = node != null ? new Node() : null;
        sizes[i] = Walk(dir + "\\" + subs[i], c, kids[i], depth + 1, app);
      }
    }
    for (int i = 0; i < subs.Count; i++) {
      sum += sizes[i];
      if (node == null) continue;
      Node child = kids[i];
      child.name = subs[i];
      node.files += child.files;
      if (sizes[i] >= KEEP_DIR) node.dirs.Add(child);
      else { node.otherSize += sizes[i]; node.otherFiles += child.files; }
    }

    if (node != null) {
      node.size = sum;
      files.Sort(delegate(KeyValuePair<string, long> a, KeyValuePair<string, long> b) { return b.Value.CompareTo(a.Value); });
      int keep = Math.Min(TOP_FILES, files.Count);
      node.top = files.GetRange(0, keep);
      for (int i = keep; i < files.Count; i++) { node.otherSize += files[i].Value; node.otherFiles++; }
      node.dirs.Sort(delegate(Node a, Node b) { return b.size.CompareTo(a.size); });
    }
    return sum;
  }

  static bool Exists(string dir) {
    FindData d;
    IntPtr h = FindFirstFileExW(@"\\?\" + Norm(dir) + @"\*", 1, out d, 0, IntPtr.Zero, 0);
    if (h == BAD) return false;
    FindClose(h);
    return true;
  }

  /** Size of one folder right now (for leftovers after an uninstall). -1 = doesn't exist. */
  public static long Size(string dir) {
    dir = Norm(dir);
    if (!Exists(dir)) return -1;
    return Walk(dir, new Ctx(), null, 0, false);
  }

  // ---------------------------------------------------------------- installed apps

  /**
   * Measures every app folder and finds when one of its programs was last started.
   * roots[i] may hold several folders split by "|" (a Steam game + its unfinished download).
   */
  public static void StartApps(string[] ids, string[] roots, string[] skips) {
    Start(delegate() {
      Dictionary<string, long> pf = Prefetch();
      List<KeyValuePair<string, long>> runs = Bam();
      runs.AddRange(UserAssist());
      StringBuilder sb = new StringBuilder("[");
      total = ids.Length;
      for (int i = 0; i < ids.Length && !cancel; i++) {
        string[] parts = roots[i].Split('|');
        string main = Norm(parts[0]);
        Ctx c = new Ctx();
        c.exes = new List<KeyValuePair<int, string>>();
        // folders of other apps inside this one (Steam games inside Steam) are counted for them
        foreach (string s in skips) {
          string ns = Norm(s);
          bool own = false;
          foreach (string p in parts) if (Norm(p).Equals(ns, StringComparison.OrdinalIgnoreCase)) own = true;
          if (!own) c.skip.Add(ns);
        }
        current = main;
        long size = -1;
        foreach (string p in parts) {
          string r = Norm(p);
          if (r.Length < 2 || !Exists(r)) continue;
          if (size < 0) size = 0;
          size += Walk(r, c, null, 0, false);
        }
        long last = 0;
        foreach (KeyValuePair<int, string> e in c.exes) {
          string file = Path.GetFileName(e.Value);
          if (Generic(file)) continue;
          long t;
          if (pf.TryGetValue(PfName(file), out t) && t > last) last = t;
        }
        string prefix = main.ToLowerInvariant() + "\\";
        foreach (KeyValuePair<string, long> r in runs)
          if (r.Value > last && r.Key.StartsWith(prefix, StringComparison.Ordinal) && !Generic(Path.GetFileName(r.Key))) last = r.Value;
        if (i > 0) sb.Append(',');
        sb.Append("{\"id\":").Append(Str(ids[i])).Append(",\"size\":").Append(size).Append(",\"last\":").Append(last).Append(",\"exes\":[");
        // shallow ones first (Sort isn't stable, so the index keeps the walk order)
        List<KeyValuePair<int, string>> ex = new List<KeyValuePair<int, string>>();
        for (int j = 0; j < c.exes.Count; j++)
          if (!Generic(Path.GetFileName(c.exes[j].Value))) ex.Add(new KeyValuePair<int, string>(c.exes[j].Key * 1000 + j, c.exes[j].Value));
        ex.Sort(delegate(KeyValuePair<int, string> a, KeyValuePair<int, string> b) { return a.Key.CompareTo(b.Key); });
        for (int j = 0; j < ex.Count && j < 12; j++) {
          if (j > 0) sb.Append(',');
          sb.Append(Str(ex[j].Value));
        }
        sb.Append("]}");
        done = i + 1;
      }
      return sb.Append(']').ToString();
    });
  }

  // helpers that run in the background or on install/uninstall — they don't mean "the user opened the app"
  static readonly string[] GENERIC = {
    "unins", "uninst", "setup", "install", "update", "crash", "redist", "prereq", "helper", "elevat",
    "report", "squirrel", "webview", "service", "cefsharp", "vc_", "dxsetup", "dotnet", "notification"
  };

  static bool Generic(string exe) {
    string l = exe.ToLowerInvariant();
    foreach (string g in GENERIC) if (l.Contains(g)) return true;
    return false;
  }

  // Prefetch file names are "PROGRAM.EXE-1A2B3C4D.pf", the name cut to 29 letters. Needs admin rights.
  static string PfName(string exe) {
    string u = exe.ToUpperInvariant();
    return u.Length > 29 ? u.Substring(0, 29) : u;
  }

  static Dictionary<string, long> Prefetch() {
    Dictionary<string, long> map = new Dictionary<string, long>(StringComparer.OrdinalIgnoreCase);
    try {
      string dir = Environment.GetFolderPath(Environment.SpecialFolder.Windows) + "\\Prefetch";
      foreach (FileInfo f in new DirectoryInfo(dir).GetFiles("*.pf")) {
        int dash = f.Name.LastIndexOf('-');
        if (dash <= 0) continue;
        string exe = f.Name.Substring(0, dash);
        long t = (long)(f.LastWriteTimeUtc - Epoch).TotalMilliseconds;
        long old;
        if (!map.TryGetValue(exe, out old) || t > old) map[exe] = t;
      }
    } catch { }
    return map;
  }

  // BAM: Windows notes the last start of every program for about a week. Needs admin rights.
  static List<KeyValuePair<string, long>> Bam() {
    List<KeyValuePair<string, long>> list = new List<KeyValuePair<string, long>>();
    try {
      Dictionary<string, string> dev = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
      foreach (string drive in Environment.GetLogicalDrives()) {
        string l = drive.Substring(0, 2);
        StringBuilder t = new StringBuilder(1024);
        if (QueryDosDeviceW(l, t, 1024) > 0) dev[t.ToString()] = l;
      }
      string sid = System.Security.Principal.WindowsIdentity.GetCurrent().User.Value;
      string[] keys = { @"SYSTEM\CurrentControlSet\Services\bam\State\UserSettings\", @"SYSTEM\CurrentControlSet\Services\bam\UserSettings\" };
      foreach (string kp in keys) {
        using (RegistryKey k = Registry.LocalMachine.OpenSubKey(kp + sid)) {
          if (k == null) continue;
          foreach (string n in k.GetValueNames()) {
            byte[] b = k.GetValue(n) as byte[];
            if (b == null || b.Length < 8 || !n.StartsWith(@"\Device\", StringComparison.OrdinalIgnoreCase)) continue;
            int cut = n.IndexOf('\\', 8);
            if (cut < 0) continue;
            string letter;
            if (!dev.TryGetValue(n.Substring(0, cut), out letter)) continue;
            list.Add(new KeyValuePair<string, long>((letter + n.Substring(cut)).ToLowerInvariant(), FtMs(BitConverter.ToInt64(b, 0))));
          }
        }
      }
    } catch { }
    return list;
  }

  // UserAssist: programs started from the Start menu / desktop (names are ROT13). Works without admin,
  // but only if "Let Windows track app launches" is on.
  static List<KeyValuePair<string, long>> UserAssist() {
    List<KeyValuePair<string, long>> list = new List<KeyValuePair<string, long>>();
    Dictionary<string, string> known = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
    known["{6D809377-6AF0-444B-8957-A3773F02200E}"] = Environment.GetEnvironmentVariable("ProgramW6432");
    known["{7C5A40EF-A0FB-4BFC-874A-C0F2E0B9FA8E}"] = Environment.GetEnvironmentVariable("ProgramFiles(x86)");
    known["{905E63B6-C1BF-494E-B29C-65B732D3D21A}"] = Environment.GetEnvironmentVariable("ProgramFiles");
    known["{F1B32785-6FBA-4FCF-9D55-7B8E7F157091}"] = Environment.GetEnvironmentVariable("LOCALAPPDATA");
    known["{3EB685DB-65F9-4CF6-A03A-E3EF65729F3D}"] = Environment.GetEnvironmentVariable("APPDATA");
    try {
      using (RegistryKey k = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Explorer\UserAssist\{CEBFF5CD-ACE2-4F4F-9178-9926F41749EA}\Count")) {
        if (k == null) return list;
        foreach (string raw in k.GetValueNames()) {
          byte[] b = k.GetValue(raw) as byte[];
          if (b == null || b.Length < 68) continue;
          string n = Rot13(raw);
          if (n.StartsWith("{") && n.Length > 39 && n[38] == '}') {
            string basePath;
            if (!known.TryGetValue(n.Substring(0, 39), out basePath) || basePath == null) continue;
            n = basePath + n.Substring(39);
          }
          if (n.Length < 3 || n[1] != ':') continue;
          long t = FtMs(BitConverter.ToInt64(b, 60));
          if (t > 0) list.Add(new KeyValuePair<string, long>(n.ToLowerInvariant(), t));
        }
      }
    } catch { }
    return list;
  }

  static string Rot13(string s) {
    char[] a = s.ToCharArray();
    for (int i = 0; i < a.Length; i++) {
      char ch = a[i];
      if (ch >= 'a' && ch <= 'z') a[i] = (char)('a' + (ch - 'a' + 13) % 26);
      else if (ch >= 'A' && ch <= 'Z') a[i] = (char)('A' + (ch - 'A' + 13) % 26);
    }
    return new string(a);
  }

  // ---------------------------------------------------------------- big / old files and copies

  public static void StartFiles(string[] roots, string[] skips, string[] skipNames, long minSize, long copyMin) {
    Start(delegate() {
      Ctx c = new Ctx();
      c.skipDot = true;
      c.parallel = true;
      c.minFile = minSize;
      c.hits = new List<Hit>();
      foreach (string s in skips) c.skip.Add(Norm(s));
      foreach (string s in skipNames) c.skipNames.Add(s);
      phase = "walk";
      total = roots.Length;
      for (int i = 0; i < roots.Length && !cancel; i++) {
        string r = Norm(roots[i]);
        if (Exists(r)) Walk(r, c, null, 0, false);
        done = i + 1;
      }
      FindCopies(c.hits, copyMin);
      StringBuilder sb = new StringBuilder();
      sb.Append("{\"scanned\":").Append(Interlocked.Read(ref seen)).Append(",\"files\":[");
      for (int i = 0; i < c.hits.Count; i++) {
        Hit h = c.hits[i];
        if (i > 0) sb.Append(',');
        sb.Append("{\"p\":").Append(Str(h.path)).Append(",\"s\":").Append(h.size).Append(",\"w\":").Append(h.write)
          .Append(",\"c\":").Append(h.create).Append(",\"a\":").Append(h.access).Append(",\"d\":").Append(h.hash == null ? "null" : Str(h.hash))
          .Append(",\"x\":").Append(h.app ? "true" : "false").Append('}');
      }
      return sb.Append("]}").ToString();
    });
  }

  // same size first (cheap), then the same content (reads the files)
  static void FindCopies(List<Hit> hits, long min) {
    Dictionary<long, List<Hit>> bySize = new Dictionary<long, List<Hit>>();
    foreach (Hit h in hits) {
      // program files repeat between programs on purpose (the same .dll in two games)
      if (h.size < min || h.app) continue;
      List<Hit> l;
      if (!bySize.TryGetValue(h.size, out l)) { l = new List<Hit>(); bySize[h.size] = l; }
      l.Add(h);
    }
    List<List<Hit>> groups = new List<List<Hit>>();
    int count = 0;
    foreach (List<Hit> l in bySize.Values) if (l.Count > 1) { groups.Add(l); count += l.Count; }
    phase = "compare";
    done = 0;
    total = count;
    foreach (List<Hit> g in groups) {
      Dictionary<string, List<Hit>> byHash = new Dictionary<string, List<Hit>>();
      foreach (Hit h in g) {
        if (cancel) return;
        current = h.path;
        string hash = Hash(h);
        done++;
        if (hash == null) continue;
        List<Hit> l;
        if (!byHash.TryGetValue(hash, out l)) { l = new List<Hit>(); byHash[hash] = l; }
        l.Add(h);
      }
      foreach (KeyValuePair<string, List<Hit>> kv in byHash)
        if (kv.Value.Count > 1) foreach (Hit h in kv.Value) h.hash = kv.Key;
    }
  }

  static string Hash(Hit h) {
    try {
      using (SHA1 sha = SHA1.Create())
      using (FileStream fs = new FileStream(h.path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete, 1 << 16)) {
        byte[] buf = new byte[1 << 20];
        if (h.size <= FULL_HASH) {
          int n;
          while ((n = fs.Read(buf, 0, buf.Length)) > 0) {
            if (cancel) return null;
            sha.TransformBlock(buf, 0, n, null, 0);
          }
        } else {
          const int parts = 32;
          for (int i = 0; i < parts; i++) {
            if (cancel) return null;
            fs.Seek((h.size - buf.Length) * i / (parts - 1), SeekOrigin.Begin);
            int got = 0, n;
            while (got < buf.Length && (n = fs.Read(buf, got, buf.Length - got)) > 0) got += n;
            sha.TransformBlock(buf, 0, got, null, 0);
          }
        }
        sha.TransformFinalBlock(new byte[0], 0, 0);
        return h.size.ToString() + "-" + BitConverter.ToString(sha.Hash).Replace("-", "");
      }
    } catch {
      return null;
    } finally {
      // reading a file changes its "last opened" date — put it back, so the file doesn't look used
      try { if (h.access > 0) File.SetLastAccessTimeUtc(h.path, Epoch.AddMilliseconds(h.access)); } catch { }
    }
  }

  // ---------------------------------------------------------------- disk map

  static Node mapRoot;
  static string mapPath;

  public static void StartMap(string root) {
    Start(delegate() {
      mapRoot = null;
      string r = Norm(root);
      Node n = new Node();
      n.name = r;
      phase = "walk";
      Ctx c = new Ctx();
      c.parallel = true;
      Walk(r, c, n, 0, false);
      if (cancel) return "null";
      mapRoot = n;
      mapPath = r;
      return Level(r);
    });
  }

  /** One folder of the scanned tree: its subfolders and biggest files. "null" = not scanned. */
  public static string Level(string path) {
    if (mapRoot == null) return "null";
    string p = Norm(path);
    Node node = mapRoot;
    if (!p.Equals(mapPath, StringComparison.OrdinalIgnoreCase)) {
      if (!p.StartsWith(mapPath + "\\", StringComparison.OrdinalIgnoreCase)) return "null";
      foreach (string part in p.Substring(mapPath.Length + 1).Split('\\')) {
        Node next = null;
        foreach (Node d in node.dirs) if (d.name.Equals(part, StringComparison.OrdinalIgnoreCase)) { next = d; break; }
        if (next == null) return "null";
        node = next;
      }
    }
    StringBuilder sb = new StringBuilder();
    sb.Append("{\"path\":").Append(Str(p)).Append(",\"size\":").Append(node.size).Append(",\"files\":").Append(node.files)
      .Append(",\"otherSize\":").Append(node.otherSize).Append(",\"otherFiles\":").Append(node.otherFiles).Append(",\"dirs\":[");
    for (int i = 0; i < node.dirs.Count && i < 200; i++) {
      Node d = node.dirs[i];
      if (i > 0) sb.Append(',');
      sb.Append("{\"n\":").Append(Str(d.name)).Append(",\"s\":").Append(d.size).Append(",\"f\":").Append(d.files)
        .Append(",\"x\":").Append(d.denied ? "true" : "false").Append('}');
    }
    sb.Append("],\"top\":[");
    for (int i = 0; i < node.top.Count; i++) {
      if (i > 0) sb.Append(',');
      sb.Append("{\"n\":").Append(Str(node.top[i].Key)).Append(",\"s\":").Append(node.top[i].Value).Append('}');
    }
    return sb.Append("]}").ToString();
  }

  // ---------------------------------------------------------------- json

  static string Str(string s) {
    if (s == null) return "null";
    StringBuilder sb = new StringBuilder(s.Length + 2);
    sb.Append('"');
    foreach (char ch in s) {
      switch (ch) {
        case '"': sb.Append("\\\""); break;
        case '\\': sb.Append("\\\\"); break;
        case '\n': sb.Append("\\n"); break;
        case '\r': sb.Append("\\r"); break;
        case '\t': sb.Append("\\t"); break;
        default:
          if (ch < 0x20 || char.IsSurrogate(ch)) sb.Append("\\u").Append(((int)ch).ToString("x4"));
          else sb.Append(ch);
          break;
      }
    }
    return sb.Append('"').ToString();
  }
}
