//////////////////////////////////////////////////////////////////////////////////////////
//   _  _ ____ _  _ ___  ____                                                           //
//   |_/  |__| |\ | |  \ |  |    This file belongs to Kando, the cross-platform         //
//   | \_ |  | | \| |__/ |__|    pie menu. Read more on github.com/kando-menu/kando     //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

// SPDX-FileCopyrightText: Simon Schneegans <code@simonschneegans.de>
// SPDX-License-Identifier: MIT

import * as z from 'zod';
import { MENU_ITEM_SCHEMA } from '../settings-schemata';

/** Enum of all possible reasons for declining a request. */
export enum IPCErrorReason {
  /** If the client is not connected to the server. */
  eNotConnected = 'not-connected',
  /** If the client failed to connect to the server. */
  eConnectionFailed = 'connection-failed',
  /** If the request was malformed and could not be parsed. */
  eMalformedRequest = 'malformed-request',
  /** If the requested API version is not supported. */
  eVersionNotSupported = 'version-not-supported',
}

/**
 * This is used to store the current websocket port for the IPC server and share it
 * between clients and the server.
 */
export const IPC_INFO_SCHEMA = z.object({
  port: z.number(),
  apiVersion: z.number(),
});

/**
 * Sent by the client to request that a menu be shown. The menu structure is provided as a
 * MENU_ITEM_SCHEMA object.
 */
export const SHOW_MENU_MESSAGE = z.object({
  type: z.literal('show-menu'),
  menu: MENU_ITEM_SCHEMA,
});

/**
 * Sent by the server to notify the client that the menu was closed without a selection.
 * This can happen if the user cancels the menu or another menu is shown on top.
 */
export const CLOSE_MENU_MESSAGE = z.object({
  type: z.literal('close-menu'),
});

/**
 * Sent by the client to notify the server that a menu item was selected. The path is an
 * array of indices representing the path to the selected item in the menu tree.
 */
export const SELECT_ITEM_MESSAGE = z.object({
  type: z.literal('select-item'),
  path: z.array(z.number()),
});

/**
 * Sent by the client to notify the server that a menu item is being hovered. The path is
 * an array of indices representing the path to the hovered item in the menu tree.
 */
export const HOVER_ITEM_MESSAGE = z.object({
  type: z.literal('hover-item'),
  path: z.array(z.number()),
});

/**
 * Sent by either client or server to indicate an error has occurred. The error field
 * contains a human-readable error message.
 */
export const ERROR_MESSAGE = z.object({
  type: z.literal('error'),
  reason: z.enum(IPCErrorReason),
  description: z.string(),
});

export type IPCInfo = z.infer<typeof IPC_INFO_SCHEMA>;
export type ShowMenuMessage = z.infer<typeof SHOW_MENU_MESSAGE>;
export type CloseMenuMessage = z.infer<typeof CLOSE_MENU_MESSAGE>;
export type SelectItemMessage = z.infer<typeof SELECT_ITEM_MESSAGE>;
export type HoverItemMessage = z.infer<typeof HOVER_ITEM_MESSAGE>;
export type ErrorMessage = z.infer<typeof ERROR_MESSAGE>;

export const IPC_MESSAGES = [
  SHOW_MENU_MESSAGE,
  CLOSE_MENU_MESSAGE,
  SELECT_ITEM_MESSAGE,
  HOVER_ITEM_MESSAGE,
  ERROR_MESSAGE,
];
