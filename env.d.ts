/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_API_KEY: string;
    readonly VITE_TMDB_API_KEY: string;
    readonly VITE_GITHUB_GIST_TOKEN?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
