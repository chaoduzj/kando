//////////////////////////////////////////////////////////////////////////////////////////
//   _  _ ____ _  _ ___  ____                                                           //
//   |_/  |__| |\ | |  \ |  |    This file belongs to Kando, the cross-platform         //
//   | \_ |  | | \| |__/ |__|    pie menu. Read more on github.com/kando-menu/kando     //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

// SPDX-FileCopyrightText: Simon Schneegans <code@simonschneegans.de>
// SPDX-License-Identifier: MIT

import { EventEmitter } from 'events';
import WebSocket, { WebSocketServer } from 'ws';
import { AddressInfo } from 'net';
import fs from 'fs';
import path from 'path';
import * as IPCTypes from './types';

import { TypedEventEmitter, MenuItem } from '..';

/** These events are emitted by the IPC server when clients send requests. */
type IPCServerEvents = {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  'show-menu': [
    menu: MenuItem,
    callbacks: {
      onSelection: (path: number[]) => void;
      onHover: (path: number[]) => void;
      onCancel: () => void;
    },
  ];
  'start-observing': [
    observerID: number,
    callbacks: {
      onOpen: () => void;
      onSelection: (path: number[]) => void;
      onHover: (path: number[]) => void;
      onCancel: () => void;
    },
  ];
  'stop-observing': [observerID: number];
};

/**
 * IPCServer listens for WebSocket connections on localhost and emits events when a
 * show-menu request is received. It allows reporting menu selections back to the client
 * via the WebSocket.
 *
 * This class is an event emitter that emits the following events:
 *
 * - 'show-menu': Emitted when a valid show-menu request is received from a client. The
 *   event handler receives the menu to show and callbacks for selection, hover, and close
 *   events.
 */
export class IPCServer extends (EventEmitter as new () => TypedEventEmitter<IPCServerEvents>) {
  /** The protocol version supported by this server. Clients must match this version. */
  private static readonly cAPIVersion = 1;

  /**
   * The WebSocket server instance. It is initialized in init() and closed in close(). It
   * is undefined when the server is not running.
   */
  private wss: WebSocketServer | undefined;

  /**
   * The port the server is listening on. It is assigned by the OS when the server starts
   * (port 0) and is written to ipc-info.json for clients to discover. It is undefined
   * until the server is initialized.
   */
  private port: number | undefined;

  /**
   * The path to the ipc-info.json file where the server writes its port and API version
   * for clients to discover. It is derived from the infoDir provided in the constructor.
   */
  private infoPath: string;

  /**
   * Whenever a client registers as an observer, it is assigned a unique observer ID. This
   * counter is used to generate those IDs.
   */
  private nextObserverID = 1;

  /**
   * Creates a new IPCServer. Call init() to start listening for connections.
   *
   * @param infoDir The directory where ipc-info.json with the port info will be stored.
   *   Usually, this is Kando's config directory.
   */
  constructor(private infoDir: string) {
    super();

    // Path to the file where the server writes its port for clients to discover.
    this.infoPath = path.join(this.infoDir, 'ipc-info.json');
  }

  /**
   * Initializes the WebSocket server and waits until it is listening.
   *
   * Writes the port to ipc-info.json for clients to discover. The port is chosen by the
   * OS (port 0), ensuring no conflicts. The server only listens on localhost for security
   * reasons.
   *
   * @returns A promise that resolves when the server is ready.
   */
  public async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Start a WebSocket server on localhost, random port.
      this.wss = new WebSocketServer({ host: '127.0.0.1', port: 0 });
      this.wss.on('connection', (ws) => this.handleConnection(ws));
      this.wss.on('listening', () => {
        // Retrieve the assigned port and write it to ipc-info.json.
        const address = this.wss.address() as AddressInfo;
        this.port = address.port;
        console.log(`Listening for show-menu requests on ws://127.0.0.1:${this.port}`);
        try {
          const info: IPCTypes.IPCInfo = {
            port: this.port,
            apiVersion: IPCServer.cAPIVersion,
          };
          fs.writeFileSync(this.infoPath, JSON.stringify(info, null, 2));
        } catch (err) {
          console.error(`IPCServer failed to write ${this.infoPath}:`, err);
        }
        resolve();
      });
      this.wss.on('error', (err) => {
        reject(err);
      });
    });
  }

  /** Closes the WebSocket server, allowing tests and processes to exit cleanly. */
  public close(): void {
    if (this.wss) {
      this.wss.close();
      this.wss = undefined;
    }
  }

  /** Returns the port the server is listening on. */
  public getPort(): number {
    return this.port;
  }

  /** Returns the API version supported by this server. */
  public getApiVersion(): number {
    return IPCServer.cAPIVersion;
  }

  /**
   * Handles a new WebSocket connection and the full IPC protocol for that client.
   *
   * This method is responsible for:
   *
   * - Validating all incoming messages using zod schemas.
   * - Emitting 'show-menu' events for valid show-menu requests, with callbacks for menu
   *   selection, hover, and close events.
   * - Sending appropriate error messages for malformed requests.
   *
   * @param ws The connected WebSocket instance.
   */
  private handleConnection(ws: WebSocket) {
    let observerID = -1; // Will be assigned if the client registers as an observer.

    ws.on('message', (data) => {
      let msg: unknown;
      try {
        // Parse the incoming message as JSON.
        msg = JSON.parse(data.toString());
      } catch (e) {
        // If parsing fails, send an error message and return.
        const errorMsg: IPCTypes.ErrorMessage = {
          type: 'error',
          reason: IPCTypes.IPCErrorReason.eMalformedRequest,
          description: e.toString(),
        };
        ws.send(JSON.stringify(errorMsg));
        return;
      }

      // Handle 'show-menu' messages: client requests to show a menu.
      const showMenuParse = IPCTypes.SHOW_MENU_MESSAGE.safeParse(msg);
      if (showMenuParse.success) {
        const showMenuMsg = showMenuParse.data;
        // Emit the 'show-menu' event with callbacks for menu interaction.
        this.emit('show-menu', showMenuMsg.menu, {
          onSelection: (path: number[]) => {
            const selectMsg: IPCTypes.SelectItemMessage = { type: 'select-item', path };
            ws.send(JSON.stringify(selectMsg));
          },
          onHover: (path: number[]) => {
            const hoverMsg: IPCTypes.HoverItemMessage = { type: 'hover-item', path };
            ws.send(JSON.stringify(hoverMsg));
          },
          onCancel: () => {
            const cancelMsg: IPCTypes.CancelMenuMessage = { type: 'cancel-menu' };
            ws.send(JSON.stringify(cancelMsg));
          },
        });
        return;
      }

      // Handle 'start-observing' messages: client wants to observe menu events.
      const startObservingParse = IPCTypes.START_OBSERVING_MESSAGE.safeParse(msg);
      if (startObservingParse.success) {
        // If the client is already an observer, send an error message and return.
        if (observerID !== -1) {
          const errorMsg: IPCTypes.ErrorMessage = {
            type: 'error',
            reason: IPCTypes.IPCErrorReason.eAlreadyObserving,
            description: 'Client is already registered as an observer',
          };
          ws.send(JSON.stringify(errorMsg));
          return;
        }

        observerID = this.nextObserverID++;
        this.emit('start-observing', observerID, {
          onOpen: () => {
            const openMsg: IPCTypes.OpenMenuMessage = { type: 'open-menu' };
            ws.send(JSON.stringify(openMsg));
          },
          onSelection: (path: number[]) => {
            const selectMsg: IPCTypes.SelectItemMessage = { type: 'select-item', path };
            ws.send(JSON.stringify(selectMsg));
          },
          onHover: (path: number[]) => {
            const hoverMsg: IPCTypes.HoverItemMessage = { type: 'hover-item', path };
            ws.send(JSON.stringify(hoverMsg));
          },
          onCancel: () => {
            const cancelMsg: IPCTypes.CancelMenuMessage = { type: 'cancel-menu' };
            ws.send(JSON.stringify(cancelMsg));
          },
        });
        return;
      }

      // Handle 'stop-observing' messages: client wants to stop observing menu events.
      const stopObservingParse = IPCTypes.STOP_OBSERVING_MESSAGE.safeParse(msg);
      if (stopObservingParse.success) {
        // If the client is not currently an observer, send an error message and return.
        if (observerID === -1) {
          const errorMsg: IPCTypes.ErrorMessage = {
            type: 'error',
            reason: IPCTypes.IPCErrorReason.eNotObserving,
            description: 'Client is not registered as an observer',
          };
          ws.send(JSON.stringify(errorMsg));
          return;
        }

        this.emit('stop-observing', observerID);
        observerID = -1;
        return;
      }

      // If the message type is not recognized, send an error.
      const errorMsg: IPCTypes.ErrorMessage = {
        type: 'error',
        reason: IPCTypes.IPCErrorReason.eMalformedRequest,
        description: 'Unknown or malformed message',
      };
      ws.send(JSON.stringify(errorMsg));
    });

    // Stop observing if the client disconnects.
    ws.on('close', () => {
      if (observerID !== -1) {
        this.emit('stop-observing', observerID);
      }
    });
  }
}
