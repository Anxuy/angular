import {
  RegExp,
  RegExpWrapper,
  StringWrapper,
  isBlank,
  isPresent,
  isType,
  isStringMap,
  BaseException
} from 'angular2/src/facade/lang';
import {
  Map,
  MapWrapper,
  List,
  ListWrapper,
  StringMap,
  StringMapWrapper
} from 'angular2/src/facade/collection';

import {PathRecognizer} from './path_recognizer';
import {RouteHandler} from './route_handler';
import {Route, AsyncRoute, Redirect, RouteDefinition} from './route_config_impl';
import {AsyncRouteHandler} from './async_route_handler';
import {SyncRouteHandler} from './sync_route_handler';
import {parseAndAssignParamString} from 'angular2/src/router/helpers';

/**
 * `RouteRecognizer` is responsible for recognizing routes for a single component.
 * It is consumed by `RouteRegistry`, which knows how to recognize an entire hierarchy of
 * components.
 */
export class RouteRecognizer {
  names: Map<string, PathRecognizer> = new Map();
  redirects: Map<string, string> = new Map();
  matchers: Map<RegExp, PathRecognizer> = new Map();

  constructor(public isRoot: boolean = false) {}

  config(config: RouteDefinition): boolean {
    var handler;
    if (config instanceof Redirect) {
      let path = config.path == '/' ? '' : config.path;
      this.redirects.set(path, config.redirectTo);
      return true;
    } else if (config instanceof Route) {
      handler = new SyncRouteHandler(config.component);
    } else if (config instanceof AsyncRoute) {
      handler = new AsyncRouteHandler(config.loader);
    }
    var recognizer = new PathRecognizer(config.path, handler, this.isRoot);
    MapWrapper.forEach(this.matchers, (matcher, _) => {
      if (recognizer.regex.toString() == matcher.regex.toString()) {
        throw new BaseException(
            `Configuration '${config.path}' conflicts with existing route '${matcher.path}'`);
      }
    });
    this.matchers.set(recognizer.regex, recognizer);
    if (isPresent(config.as)) {
      this.names.set(config.as, recognizer);
    }
    return recognizer.terminal;
  }


  /**
   * Given a URL, returns a list of `RouteMatch`es, which are partial recognitions for some route.
   *
   */
  recognize(url: string): List<RouteMatch> {
    var solutions = [];
    if (url.length > 0 && url[url.length - 1] == '/') {
      url = url.substring(0, url.length - 1);
    }

    MapWrapper.forEach(this.redirects, (target, path) => {
      // "/" redirect case
      if (path == '/' || path == '') {
        if (path == url) {
          url = target;
        }
      } else if (url.startsWith(path)) {
        url = target + url.substring(path.length);
      }
    });

    var queryParams = StringMapWrapper.create();
    var queryString = '';
    var queryIndex = url.indexOf('?');
    if (queryIndex >= 0) {
      queryString = url.substring(queryIndex + 1);
      url = url.substring(0, queryIndex);
    }
    if (this.isRoot && queryString.length > 0) {
      parseAndAssignParamString('&', queryString, queryParams);
    }

    MapWrapper.forEach(this.matchers, (pathRecognizer, regex) => {
      var match;
      if (isPresent(match = RegExpWrapper.firstMatch(regex, url))) {
        var matchedUrl = '/';
        var unmatchedUrl = '';
        if (url != '/') {
          matchedUrl = match[0];
          unmatchedUrl = url.substring(match[0].length);
        }
        var params = null;
        if (pathRecognizer.terminal && !StringMapWrapper.isEmpty(queryParams)) {
          params = queryParams;
          matchedUrl += '?' + queryString;
        }
        solutions.push(new RouteMatch(pathRecognizer, matchedUrl, unmatchedUrl, params));
      }
    });

    return solutions;
  }

  hasRoute(name: string): boolean { return this.names.has(name); }

  generate(name: string, params: any): StringMap<string, any> {
    var pathRecognizer: PathRecognizer = this.names.get(name);
    if (isBlank(pathRecognizer)) {
      return null;
    }
    var url = pathRecognizer.generate(params);
    return {url, 'nextComponent': pathRecognizer.handler.componentType};
  }
}

export class RouteMatch {
  private _params: StringMap<string, any>;
  private _paramsParsed: boolean = false;

  constructor(public recognizer: PathRecognizer, public matchedUrl: string,
              public unmatchedUrl: string, p: StringMap<string, any> = null) {
    this._params = isPresent(p) ? p : StringMapWrapper.create();
  }

  params(): StringMap<string, any> {
    if (!this._paramsParsed) {
      this._paramsParsed = true;
      StringMapWrapper.forEach(this.recognizer.parseParams(this.matchedUrl),
                               (value, key) => { StringMapWrapper.set(this._params, key, value); });
    }
    return this._params;
  }
}

function configObjToHandler(config: any): RouteHandler {
  if (isType(config)) {
    return new SyncRouteHandler(config);
  } else if (isStringMap(config)) {
    if (isBlank(config['type'])) {
      throw new BaseException(
          `Component declaration when provided as a map should include a 'type' property`);
    }
    var componentType = config['type'];
    if (componentType == 'constructor') {
      return new SyncRouteHandler(config['constructor']);
    } else if (componentType == 'loader') {
      return new AsyncRouteHandler(config['loader']);
    } else {
      throw new BaseException(`oops`);
    }
  }
  throw new BaseException(`Unexpected component "${config}".`);
}
