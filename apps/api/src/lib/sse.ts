import { Redis } from 'ioredis';

// Локальный реестр соединений на этом инстансе: taskId -> Set(send functions)
const localClients = new Map<string, Set<(data: object) => void>>();

// Redis клиенты для Pub/Sub
const pub = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const sub = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

const CHANNEL_PREFIX = 'task:events:';

// Инициализация глобального слушателя
sub.psubscribe(`${CHANNEL_PREFIX}*`).catch((err: unknown) => {
  console.error('Failed to subscribe to Redis SSE events:', err);
});

sub.on('pmessage', (_pattern: string, channel: string, message: string) => {
  const taskId = channel.replace(CHANNEL_PREFIX, '');
  const clients = localClients.get(taskId);

  if (clients) {
    const data = JSON.parse(message);
    clients.forEach((send) => send(data));
  }
});

export const sseManager = {
  /**
   * Регистрирует локальное SSE соединение
   */
  register(taskId: string, sendFn: (data: object) => void) {
    if (!localClients.has(taskId)) {
      localClients.set(taskId, new Set());
    }
    localClients.get(taskId)!.add(sendFn);
  },

  /**
   * Удаляет локальное соединение
   */
  unregister(taskId: string, sendFn: (data: object) => void) {
    const clients = localClients.get(taskId);
    if (clients) {
      clients.delete(sendFn);
      if (clients.size === 0) {
        localClients.delete(taskId);
      }
    }
  },

  /**
   * Публикует событие в Redis — его увидят все инстансы API
   */
  async publish(taskId: string, data: object) {
    await pub.publish(`${CHANNEL_PREFIX}${taskId}`, JSON.stringify(data));
  }
};

/**
 * Обратная совместимость с существующим кодом (Proxy для старого Map интерфейса)
 * @deprecated Use sseManager instead
 */
export const sseClients = {
  set: (taskId: string, send: any) => sseManager.register(taskId, send),
  delete: (taskId: string) => { /* В текущей реализации удаление требует ссылку на функцию */ }
};