import {bootstrap} from 'angular2/bootstrap';

import {App} from './app';

import {APP_VIEW_POOL_CAPACITY} from 'angular2/src/core/compiler/view_pool';
import {bind} from 'angular2/di';

export function main() {
  bootstrap(App, createBindings());
}

function createBindings(): List {
  return [bind(APP_VIEW_POOL_CAPACITY).toValue(100000)];
}
