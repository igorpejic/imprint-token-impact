export type Phase = 'idle' | 'working' | 'settling' | 'complete'

export type Impact = {
  water: number
  energy: number
  co2: number
}

export type DemoMode = 'full' | 'lighter'
