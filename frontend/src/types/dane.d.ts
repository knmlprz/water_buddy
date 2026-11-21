declare module '@/lib/dzialka.mjs' {
  export function pobierzDzialke(args: {
    id?: string
    lon?: number
    lat?: number
    signal?: AbortSignal
  }): Promise<{ id: string; lon: number; lat: number; ring: [number, number][] }>
}

declare module '@/lib/raport.mjs' {
  export function zbudujRaport(body: {
    id?: string
    lon?: number
    lat?: number
    uprawa?: string
    data?: string
  }): Promise<Record<string, unknown>>
}

declare module '@/lib/mercator.mjs' {
  export function project(lon: number, lat: number, z: number): { x: number; y: number }
  export function unproject(x: number, y: number, z: number): { lon: number; lat: number }
}

declare module '@/lib/bilans.mjs' {
  export const MIESIACE: string[]
  export const UPRAWY: { id: string; nazwa: string }[]
}
