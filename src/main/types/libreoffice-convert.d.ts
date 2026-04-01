declare module 'libreoffice-convert' {
  function convert(
    inputBuffer: Buffer,
    outputFormat: string,
    filter: string | undefined,
    callback: (err: Error | null, result: Buffer) => void
  ): void
  export = { convert }
}
