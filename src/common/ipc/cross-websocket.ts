//////////////////////////////////////////////////////////////////////////////////////////
//   _  _ ____ _  _ ___  ____                                                           //
//   |_/  |__| |\ | |  \ |  |    This file belongs to Kando, the cross-platform         //
//   | \_ |  | | \| |__/ |__|    pie menu. Read more on github.com/kando-menu/kando     //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

// SPDX-FileCopyrightText: Simon Schneegans <code@simonschneegans.de>
// SPDX-License-Identifier: MIT

/**
 * Selects the appropriate WebSocket implementation for Node.js or browser/Electron
 * renderer.
 */
export function createCrossWebSocket(url: string): {
  send(data: string): void;
  close(): void;
  onopen?: () => void;
  onmessage?: (event: { data: string }) => void;
  onerror?: (event: unknown) => void;
} {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  const WebSocketImpl =
    typeof window !== 'undefined' && typeof window.WebSocket !== 'undefined'
      ? window.WebSocket
      : require('ws');
  return new WebSocketImpl(url);
}
