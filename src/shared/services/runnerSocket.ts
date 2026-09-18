import { supabase, isSupabaseConfigured } from '@/shared/lib/supabase';

type SocketEventCallback = (payload: any) => void;

class RunnerSocketClient {
  private ws: WebSocket | null = null;
  private listeners = new Map<string, Set<SocketEventCallback>>();
  private reconnectTimer: any = null;
  private isConnecting = false;
  private activeSupabaseChannels = new Map<string, any>();

  get connecting() {
    return this.isConnecting;
  }

  connect() {
    // 1. Connect Local WebSocket daemon
    if (!this.ws || (this.ws.readyState !== WebSocket.OPEN && this.ws.readyState !== WebSocket.CONNECTING)) {
      this.isConnecting = true;
      const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';

      try {
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          this.isConnecting = false;
          if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
          this.emit('connected', { time: new Date().toISOString() });
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type) {
              this.emit(data.type, data.payload);
            }
          } catch {
            // ignore non-json frames
          }
        };

        this.ws.onclose = () => {
          this.isConnecting = false;
          this.ws = null;
          this.emit('disconnected', {});
          this.reconnectTimer = setTimeout(() => this.connect(), 3000);
        };

        this.ws.onerror = () => {
          this.isConnecting = false;
        };
      } catch {
        this.isConnecting = false;
        this.reconnectTimer = setTimeout(() => this.connect(), 3000);
      }
    }
  }

  /**
   * Subscribe to a specific run stream (via both local WebSocket and Supabase Realtime)
   */
  subscribeToRunStream(runId: string) {
    if (!runId || this.activeSupabaseChannels.has(runId)) return;

    if (isSupabaseConfigured() && supabase) {
      const channel = supabase.channel(`run:${runId}`)
        .on('broadcast', { event: 'stage_update' }, ({ payload }) => {
          this.emit('stage_update', payload);
        })
        .on('broadcast', { event: 'log_chunk' }, ({ payload }) => {
          this.emit('log_chunk', payload);
        })
        .on('broadcast', { event: 'run_completed' }, ({ payload }) => {
          this.emit('run_completed', payload);
        })
        .on('broadcast', { event: 'run_failed' }, ({ payload }) => {
          this.emit('run_failed', payload);
        })
        .on('broadcast', { event: 'run_cancelled' }, ({ payload }) => {
          this.emit('run_cancelled', payload);
        })
        .subscribe();

      this.activeSupabaseChannels.set(runId, channel);
    }
  }

  unsubscribeFromRunStream(runId: string) {
    const channel = this.activeSupabaseChannels.get(runId);
    if (channel && supabase) {
      supabase.removeChannel(channel);
      this.activeSupabaseChannels.delete(runId);
    }
  }

  on(event: string, callback: SocketEventCallback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  emit(event: string, payload: any) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(cb => {
        try {
          cb(payload);
        } catch (err) {
          console.error(`Error in WebSocket listener for ${event}:`, err);
        }
      });
    }
  }
}

export const runnerSocket = new RunnerSocketClient();
