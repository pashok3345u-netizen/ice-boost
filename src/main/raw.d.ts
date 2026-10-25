// Files bundled as text (C# and PowerShell sources) — `import x from './file.cs?raw'`
declare module '*?raw' {
  const text: string
  export default text
}
