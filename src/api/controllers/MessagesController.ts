import { APIResponse } from '@playwright/test';
import { z } from 'zod';
import { ENDPOINTS } from '../../constants/endpoints';
import { MessageDto, MessageDtoSchema } from '../../models';
import { HttpClient } from '../HttpClient';

/** A mailbox view of `GET messages?container=`. */
export type MessageContainer = 'Inbox' | 'Outbox' | 'Unread';

/**
 * `API/Controllers/MessagesController.cs` - the REST side of messaging. The UI
 * itself sends through the SignalR hub; this is for arranging data around it.
 */
export class MessagesController {
  constructor(private readonly http: HttpClient) {}

  /** `POST messages`, as-is - messaging yourself or a user that does not exist answers 400. */
  sendRaw(recipientUsername: string, content: string): Promise<APIResponse> {
    return this.http.post(ENDPOINTS.messages.send, { recipientUsername, content });
  }

  /** Sends `content` to `recipientUsername` from the caller. */
  async send(recipientUsername: string, content: string): Promise<MessageDto> {
    return this.http.parse(await this.sendRaw(recipientUsername, content), MessageDtoSchema);
  }

  /** `GET messages?container=...`, as-is - the caller's own messages in that view. */
  containerRaw(container: MessageContainer): Promise<APIResponse> {
    return this.http.get(`${ENDPOINTS.messages.container}?container=${container}`);
  }

  /**
   * The caller's conversation with `username`, oldest first. Marks the messages
   * sent to the caller as read, and leaves out every message the caller has
   * already deleted.
   */
  async thread(username: string): Promise<MessageDto[]> {
    return this.http.parse(await this.http.get(ENDPOINTS.messages.thread(username)), z.array(MessageDtoSchema));
  }

  /**
   * `DELETE messages/{id}`, as-is. It only flags the caller's own side; the row
   * goes once both sides have deleted it. A message that does not exist - or no
   * longer does - answers 400, one between two other users 403.
   */
  removeRaw(id: number): Promise<APIResponse> {
    return this.http.delete(ENDPOINTS.messages.remove(id));
  }
}
