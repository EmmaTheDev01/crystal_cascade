// Allow importing CSS files as modules (side-effect imports only)
declare module '*.css' {
  const content: Record<string, string>;
  export default content;
}
