/// <reference types="vite-plus/client" />

declare module "*.css?url" {
  const content: string;
  export default content;
}
