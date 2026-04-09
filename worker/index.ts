import { routeRoomRequest, type MultiplayerEnv } from './routes/rooms'
import { routeChatOnlineRequest, type ChatOnlineEnv } from './routes/apps/chat-online'
import { GameRoomDurableObject } from './durable-objects/game-room'
import { ChatRoomDurableObject } from './durable-objects/chat-room'

export { GameRoomDurableObject }
export { ChatRoomDurableObject }

export type Env = MultiplayerEnv & ChatOnlineEnv

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const chatOnlineResponse = await routeChatOnlineRequest(request, env)
    if (chatOnlineResponse) {
      return chatOnlineResponse
    }

    const routed = await routeRoomRequest(request, env)
    if (routed) {
      return routed
    }

    return env.ASSETS.fetch(request)
  },
}
