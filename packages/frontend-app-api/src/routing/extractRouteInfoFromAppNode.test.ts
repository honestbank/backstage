/*
 * Copyright 2020 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React from 'react';
import { BackstagePlugin } from '@backstage/core-plugin-api';
import { extractRouteInfoFromAppNode } from './extractRouteInfoFromAppNode';
import {
  AnyRouteRefParams,
  Extension,
  RouteRef,
  coreExtensionData,
  createExtension,
  createExtensionInput,
  createPlugin,
  createRouteRef,
} from '@backstage/frontend-plugin-api';
import { MockConfigApi } from '@backstage/test-utils';
import { createAppTree } from '../tree';
import { Core } from '../extensions/Core';
import { CoreRoutes } from '../extensions/CoreRoutes';
import { CoreNav } from '../extensions/CoreNav';
import { CoreLayout } from '../extensions/CoreLayout';

const ref1 = createRouteRef();
const ref2 = createRouteRef();
const ref3 = createRouteRef();
const ref4 = createRouteRef();
const ref5 = createRouteRef();
const refOrder: RouteRef<AnyRouteRefParams>[] = [ref1, ref2, ref3, ref4, ref5];

function createTestExtension(options: {
  id: string;
  parent?: string;
  path?: string;
  routeRef?: RouteRef;
}) {
  return createExtension({
    id: options.id,
    attachTo: options.parent
      ? { id: options.parent, input: 'children' }
      : { id: 'core.routes', input: 'routes' },
    output: {
      element: coreExtensionData.reactElement,
      path: coreExtensionData.routePath.optional(),
      routeRef: coreExtensionData.routeRef.optional(),
    },
    inputs: {
      children: createExtensionInput({
        element: coreExtensionData.reactElement,
      }),
    },
    factory() {
      return {
        path: options.path,
        routeRef: options.routeRef,
        element: React.createElement('div'),
      };
    },
  });
}

function routeInfoFromExtensions(extensions: Extension<unknown>[]) {
  const plugin = createPlugin({
    id: 'test',
    extensions,
  });
  const tree = createAppTree({
    config: new MockConfigApi({}),
    builtinExtensions: [Core, CoreRoutes, CoreNav, CoreLayout],
    features: [plugin],
  });

  return extractRouteInfoFromAppNode(tree.root);
}

function sortedEntries<T>(map: Map<RouteRef, T>): [RouteRef, T][] {
  return Array.from(map).sort(
    ([a], [b]) => refOrder.indexOf(a) - refOrder.indexOf(b),
  );
}

function routeObj(
  path: string,
  refs: RouteRef[],
  children: any[] = [],
  type: 'mounted' | 'gathered' = 'mounted',
  backstagePlugin?: BackstagePlugin,
) {
  return {
    path: path,
    caseSensitive: false,
    element: type,
    routeRefs: new Set(refs),
    children: [
      {
        path: '*',
        caseSensitive: false,
        element: 'match-all',
        routeRefs: new Set(),
        plugins: new Set(),
      },
      ...children,
    ],
    plugins: backstagePlugin ? new Set([backstagePlugin]) : new Set(),
  };
}

describe('discovery', () => {
  it('should collect routes', () => {
    const info = routeInfoFromExtensions([
      createTestExtension({
        id: 'nothing',
        path: 'nothing',
      }),
      createTestExtension({
        id: 'page1',
        path: 'foo',
        routeRef: ref1,
      }),
      createTestExtension({
        id: 'page2',
        parent: 'page1',
        path: 'bar/:id',
        routeRef: ref2,
      }),
      createTestExtension({
        id: 'page3',
        parent: 'page2',
        path: 'baz',
        routeRef: ref3,
      }),
      createTestExtension({
        id: 'page4',
        path: 'divsoup',
        routeRef: ref4,
      }),
      createTestExtension({
        id: 'page5',
        parent: 'page1',
        path: 'blop',
        routeRef: ref5,
      }),
    ]);

    expect(sortedEntries(info.routePaths)).toEqual([
      [ref1, 'foo'],
      [ref2, 'bar/:id'],
      [ref3, 'baz'],
      [ref4, 'divsoup'],
      [ref5, 'blop'],
    ]);
    expect(sortedEntries(info.routeParents)).toEqual([
      [ref1, undefined],
      [ref2, ref1],
      [ref3, ref2],
      [ref4, undefined],
      [ref5, ref1],
    ]);
    expect(info.routeObjects).toEqual([
      routeObj('nothing', []),
      routeObj(
        'foo',
        [ref1],
        [
          routeObj(
            'bar/:id',
            [ref2],
            [routeObj('baz', [ref3], undefined, undefined, expect.any(Object))],
            undefined,
            expect.any(Object),
          ),
          routeObj('blop', [ref5], undefined, undefined, expect.any(Object)),
        ],
        undefined,
        expect.any(Object),
      ),
      routeObj('divsoup', [ref4], undefined, undefined, expect.any(Object)),
    ]);
  });

  it('should handle all react router Route patterns', () => {
    const info = routeInfoFromExtensions([
      createTestExtension({
        id: 'page1',
        path: 'foo',
        routeRef: ref1,
      }),
      createTestExtension({
        id: 'page2',
        parent: 'page1',
        path: 'bar/:id',
        routeRef: ref2,
      }),
      createTestExtension({
        id: 'page3',
        path: 'baz',
        routeRef: ref3,
      }),
      createTestExtension({
        id: 'page4',
        parent: 'page3',
        path: 'divsoup',
        routeRef: ref4,
      }),
      createTestExtension({
        id: 'page5',
        parent: 'page3',
        path: 'blop',
        routeRef: ref5,
      }),
    ]);

    expect(sortedEntries(info.routePaths)).toEqual([
      [ref1, 'foo'],
      [ref2, 'bar/:id'],
      [ref3, 'baz'],
      [ref4, 'divsoup'],
      [ref5, 'blop'],
    ]);
    expect(sortedEntries(info.routeParents)).toEqual([
      [ref1, undefined],
      [ref2, ref1],
      [ref3, undefined],
      [ref4, ref3],
      [ref5, ref3],
    ]);
  });

  it('should strip leading slashes in route paths', () => {
    const info = routeInfoFromExtensions([
      createTestExtension({
        id: 'page1',
        path: '/foo',
        routeRef: ref1,
      }),
      createTestExtension({
        id: 'page2',
        parent: 'page1',
        path: '/bar/:id',
        routeRef: ref2,
      }),
      createTestExtension({
        id: 'page3',
        path: '/baz',
        routeRef: ref3,
      }),
      createTestExtension({
        id: 'page4',
        parent: 'page3',
        path: '/divsoup',
        routeRef: ref4,
      }),
      createTestExtension({
        id: 'page5',
        parent: 'page3',
        path: '/blop',
        routeRef: ref5,
      }),
    ]);

    expect(sortedEntries(info.routePaths)).toEqual([
      [ref1, 'foo'],
      [ref2, 'bar/:id'],
      [ref3, 'baz'],
      [ref4, 'divsoup'],
      [ref5, 'blop'],
    ]);
    expect(sortedEntries(info.routeParents)).toEqual([
      [ref1, undefined],
      [ref2, ref1],
      [ref3, undefined],
      [ref4, ref3],
      [ref5, ref3],
    ]);
  });

  it('should use the route aggregator key to bind child routes to the same path', () => {
    const info = routeInfoFromExtensions([
      createTestExtension({
        id: 'foo',
        path: 'foo',
      }),
      createTestExtension({
        id: 'page1',
        parent: 'foo',
        routeRef: ref1,
      }),
      createTestExtension({
        id: 'fooChild',
        parent: 'foo',
      }),
      createTestExtension({
        id: 'page2',
        parent: 'fooChild',
        routeRef: ref2,
      }),
      createTestExtension({
        id: 'fooEmpty',
        parent: 'foo',
      }),
      createTestExtension({
        id: 'page3',
        path: 'bar',
        routeRef: ref3,
      }),
      createTestExtension({
        id: 'page3Child',
        parent: 'page3',
        path: '',
      }),
      createTestExtension({
        id: 'page4',
        parent: 'page3Child',
        routeRef: ref4,
      }),
      createTestExtension({
        id: 'page5',
        parent: 'page4',
        routeRef: ref5,
      }),
    ]);

    expect(sortedEntries(info.routePaths)).toEqual([
      [ref1, 'foo'],
      [ref2, 'foo'],
      [ref3, 'bar'],
      [ref4, ''],
      [ref5, ''],
    ]);
    expect(sortedEntries(info.routeParents)).toEqual([
      [ref1, undefined],
      [ref2, undefined],
      [ref3, undefined],
      [ref4, ref3],
      [ref5, ref3],
    ]);
    expect(info.routeObjects).toEqual([
      routeObj('foo', [ref1, ref2], [], 'mounted', expect.any(Object)),
      routeObj(
        'bar',
        [ref3],
        [routeObj('', [ref4, ref5], [], 'mounted', expect.any(Object))],
        'mounted',
        expect.any(Object),
      ),
    ]);
  });

  it('should use the route aggregator but stop when encountering explicit path', () => {
    const info = routeInfoFromExtensions([
      createTestExtension({
        id: 'page1',
        path: 'foo',
        routeRef: ref1,
      }),
      createTestExtension({
        id: 'page1Child',
        parent: 'page1',
        path: 'bar',
      }),
      createTestExtension({
        id: 'page2',
        parent: 'page1Child',
        routeRef: ref2,
      }),
      createTestExtension({
        id: 'page3',
        parent: 'page2',
        path: 'baz',
        routeRef: ref3,
      }),
      createTestExtension({
        id: 'page4',
        parent: 'page3',
        path: '/blop',
        routeRef: ref4,
      }),
      createTestExtension({
        id: 'page5',
        parent: 'page2',
        routeRef: ref5,
      }),
    ]);

    expect(sortedEntries(info.routePaths)).toEqual([
      [ref1, 'foo'],
      [ref2, 'bar'],
      [ref3, 'baz'],
      [ref4, 'blop'],
      [ref5, 'bar'],
    ]);
    expect(sortedEntries(info.routeParents)).toEqual([
      [ref1, undefined],
      [ref2, ref1],
      [ref3, ref2],
      [ref4, ref3],
      [ref5, ref1],
    ]);
    expect(info.routeObjects).toEqual([
      routeObj(
        'foo',
        [ref1],
        [
          routeObj(
            'bar',
            [ref2, ref5],
            [
              routeObj(
                'baz',
                [ref3],
                [
                  routeObj(
                    'blop',
                    [ref4],
                    undefined,
                    undefined,
                    expect.any(Object),
                  ),
                ],
                undefined,
                expect.any(Object),
              ),
            ],
            'mounted',
            expect.any(Object),
          ),
        ],
        undefined,
        expect.any(Object),
      ),
    ]);
  });

  it('should account for loose route paths', () => {
    const info = routeInfoFromExtensions([
      createTestExtension({
        id: 'r',
        path: 'r',
      }),
      createTestExtension({
        id: 'page1',
        parent: 'r',
        path: 'x',
        routeRef: ref1,
      }),
      createTestExtension({
        id: 'y',
        path: 'y',
        parent: 'r',
      }),
      createTestExtension({
        id: 'page2',
        parent: 'y',
        path: '1',
        routeRef: ref2,
      }),
      createTestExtension({
        id: 'page3',
        parent: 'page2',
        path: 'a',
        routeRef: ref3,
      }),
      createTestExtension({
        id: 'page4',
        parent: 'page2',
        path: 'b',
        routeRef: ref4,
      }),
    ]);

    expect(sortedEntries(info.routePaths)).toEqual([
      [ref1, 'r/x'],
      [ref2, 'r/y/1'],
      [ref3, 'a'],
      [ref4, 'b'],
    ]);
    expect(sortedEntries(info.routeParents)).toEqual([
      [ref1, undefined],
      [ref2, undefined],
      [ref3, ref2],
      [ref4, ref2],
    ]);
    expect(info.routeObjects).toEqual([
      routeObj(
        'r',
        [],
        [
          routeObj('x', [ref1], [], 'mounted', expect.any(Object)),
          routeObj(
            'y',
            [],
            [
              routeObj(
                '1',
                [ref2],
                [
                  routeObj(
                    'a',
                    [ref3],
                    undefined,
                    'mounted',
                    expect.any(Object),
                  ),
                  routeObj(
                    'b',
                    [ref4],
                    undefined,
                    'mounted',
                    expect.any(Object),
                  ),
                ],
                'mounted',
                expect.any(Object),
              ),
            ],
            'mounted',
          ),
        ],
      ),
    ]);
  });
});
