//////////////////////////////////////////////////////////////////////////////////////////
//   _  _ ____ _  _ ___  ____                                                           //
//   |_/  |__| |\ | |  \ |  |    This file belongs to Kando, the cross-platform         //
//   | \_ |  | | \| |__/ |__|    pie menu. Read more on github.com/kando-menu/kando     //
//                                                                                      //
//////////////////////////////////////////////////////////////////////////////////////////

// SPDX-FileCopyrightText: Simon Schneegans <code@simonschneegans.de>
// SPDX-License-Identifier: MIT

import React from 'react';

import * as classes from './Blossom.module.scss';

const blossom = require('../../../../assets/images/blossom_large.svg');

type Props = {
  readonly size?: number | string;
  readonly cropRight?: number;
  readonly cropBottom?: number;
  readonly top?: number | string;
  readonly left?: number | string;
  readonly right?: number | string;
  readonly bottom?: number | string;
};

/**
 * Blossom component displays a decorative blossom image.
 *
 * @param props The properties for the blossom component.
 * @returns An image element displaying the blossom image.
 */
export default function Blossom(props: Props) {
  return (
    <img
      className={classes.blossom}
      src={blossom}
      style={{
        position: 'absolute',
        width: props.size,
        height: props.size,
        top: props.top,
        left: props.left,
        right: props.right,
        bottom: props.bottom,
        objectFit: 'cover',
        objectPosition: `${props.cropRight || 0}px ${props.cropBottom || 0}px`,
      }}
    />
  );
}
