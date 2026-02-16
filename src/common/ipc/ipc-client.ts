//////////////////////////////////////////////////////////////////////////////////////////
//   _  _ ____ _  _ ___  ____                                                           //
//   |_/  |__| |\ | |  \ |  |    This file belongs to Kando, the cross-platform         //
//   | \_ |  | | \| |__/ |__|    pie menu. Read more on github.com/kando-menu/kando     //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

// SPDX-FileCopyrightText: Simon Schneegans <code@simonschneegans.de>
// SPDX-License-Identifier: MIT

import { EventEmitter } from 'events';

import * as IPCTypes from './types';
import { TypedEventEmitter, MenuItem } from '..';

// Select the appropriate WebSocket implementation for Node.js or browser/Electron renderer.
const crossWebSocket =
  typeof window !== 'undefined' && typeof window.WebSocket !== 'undefined'
    ? window.WebSocket
    : require('ws');

// Define a minimal cross-environment WebSocket type
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
type CrossWebSocket = {
  send(data: string): void;
  close(): void;
  onopen?: () => void;
  onmessage?: (event: { data: string }) => void;
  onerror?: (event: unknown) => void;
};

/** These events are emitted by the IPC client when menu interactions occur. */
type IPCClientEvents = {
  select: [path: number[]];
  cancel: [];
  hover: [path: number[]];
  error: [error: IPCTypes.IPCErrorReason];
};

/**
 * IPCClient provides a reference implementation for connecting to the Kando IPC server
 * via WebSockets. It handles menu requests and event emission for menu interactions. This
 * class is used by Kando itself to show menus from the settings renderer process and can
 * serve as a template for plugin authors.
 *
 * Usage:
 *
 *     const client = new IPCClient(12345); // Port must match the one in ipc-info.json
 *     await client.init();
 *     client.showMenu(menuItem);
 *     client.on('select', (path) => { ... });
 *     client.on('cancel', () => { ... });
 *     client.on('hover', (path) => { ... });
 */
export class IPCClient extends (EventEmitter as new () => TypedEventEmitter<IPCClientEvents>) {
  private ws: CrossWebSocket | null = null;

  /**
   * This is the API version of the client. For now, there is only version 1, but this
   * allows for future compatibility checks if the protocol evolves.
   */
  private clientApiVersion = 1;

  /**
   * Constructs a new IPCClient instance.
   *
   * @param serverPort The port used by the IPC server.
   * @param serverApiVersion The API version supported by the server, for compatibility
   *   checks.
   */
  constructor(
    private serverPort: number,
    private serverApiVersion: number
  ) {
    super();
  }

  /**
   * Initializes the IPC client by connecting to the WebSocket server. Resolves if the
   * connection is established, or rejects with the decline reason if it fails.
   *
   * @returns A promise resolving when the connection is established.
   */
  public async init(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (this.clientApiVersion !== this.serverApiVersion) {
        reject(IPCTypes.IPCErrorReason.eVersionNotSupported);
        return;
      }

      this.ws = new crossWebSocket(`ws://127.0.0.1:${this.serverPort}`) as CrossWebSocket;
      let connectionEstablished = false;

      this.ws.onopen = () => handleOpen();
      this.ws.onmessage = (event: { data: string }) => handleMessage(event.data);
      this.ws.onerror = () => handleError();

      const handleOpen = (): void => {
        connectionEstablished = true;
        resolve();
      };

      const handleMessage = (data: string): void => {
        const msg = JSON.parse(data);

        if (IPCTypes.SELECT_ITEM_MESSAGE.safeParse(msg).success) {
          this.emit('select', (msg as IPCTypes.SelectItemMessage).path);
        } else if (IPCTypes.CLOSE_MENU_MESSAGE.safeParse(msg).success) {
          this.emit('cancel');
        } else if (IPCTypes.HOVER_ITEM_MESSAGE.safeParse(msg).success) {
          this.emit('hover', (msg as IPCTypes.HoverItemMessage).path);
        } else if (IPCTypes.ERROR_MESSAGE.safeParse(msg).success) {
          const errorMsg = msg as IPCTypes.ErrorMessage;
          console.error(`IPC Error (${errorMsg.reason}): ${errorMsg.description}`);
          this.emit('error', errorMsg.reason);
        }
      };

      const handleError = (): void => {
        if (!connectionEstablished) {
          this.ws = null;
          reject(IPCTypes.IPCErrorReason.eConnectionFailed);
        } else {
          this.emit('error', IPCTypes.IPCErrorReason.eMalformedRequest);
        }
      };
    });
  }

  /**
   * Sends a show-menu request to the IPC server. The menu structure must conform to the
   * MenuItem type. Emits the 'error' event if the request is malformed or if the client
   * is not connected.
   *
   * @param menu The menu structure to show, as a MenuItem object.
   */
  public showMenu(menu: MenuItem): void {
    if (!this.ws) {
      this.emit('error', IPCTypes.IPCErrorReason.eNotConnected);
      return;
    }
    this.ws.send(JSON.stringify({ type: 'show-menu', menu }));
  }

  /** Closes the WebSocket connection, allowing tests and processes to exit cleanly. */
  public close(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
