/** Build-time flag (esbuild define): true in the Firefox build. */
declare const __FIREFOX__: boolean;

declare module '*.css' {
  const text: string;
  export default text;
}
