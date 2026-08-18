// src/sendEnvironmentInfo/index.ts
import { debug as debug4, info as info2, setFailed, setOutput } from "@actions/core";

// src/core/utils.ts
import { getInput } from "@actions/core";
var PUNCT = `!:;<=>?,@#%&*+_\\-./^|~{}[\\]'"`;
var SEPARATOR = "[\\s" + PUNCT + "]";
var KEY_PREFIX_REGEX = "(?:(?<=" + SEPARATOR + ")|^)";
var KEY_BODY_REGEX = "([A-Z][A-Z\\d_]{1,255}-\\d{1,100})";
var KEY_POSTFIX_REGEX = "(?:(?=" + SEPARATOR + ")|$)";
var ISSUE_KEY_REGEX = KEY_PREFIX_REGEX + KEY_BODY_REGEX + KEY_POSTFIX_REGEX;
function extractIssueKeys(text) {
  return text.match(new RegExp(ISSUE_KEY_REGEX, "g")) || [];
}
function unique(values) {
  return Array.from(new Set(values));
}
function getNumber(key) {
  const input = getInput(key);
  if (input) {
    const value = parseInt(input);
    if (Number.isNaN(value)) {
      throw new Error(`cannot parse number value ${input}`);
    }
    return value;
  }
  return void 0;
}
function getBoolean(key, defaultValue) {
  const input = getInput(key);
  return input ? input.toLocaleLowerCase().trim() === "true" : defaultValue;
}
function getAttributes(key) {
  const attributes = getInput(key);
  try {
    return attributes ? JSON.parse(attributes) : void 0;
  } catch (e) {
    throw new Error("Could not parse attributes: " + e);
  }
}
function getString(key, mandatory = false) {
  const value = getInput(key, { trimWhitespace: true, required: mandatory });
  return value.length ? value : void 0;
}
function getIssueKeys(key) {
  const issueKeys = getString(key);
  if (!issueKeys) {
    return void 0;
  }
  return issueKeys.replace(/\s/g, "").split(",");
}
function s(o) {
  if (!o) {
    return "n/a";
  }
  try {
    return JSON.stringify(o);
  } catch {
    return `${o}`;
  }
}

// src/client/core/bodySerializer.gen.ts
var jsonBodySerializer = {
  bodySerializer: (body) => JSON.stringify(body, (_key, value) => typeof value === "bigint" ? value.toString() : value)
};

// src/client/core/params.gen.ts
var extraPrefixesMap = {
  $body_: "body",
  $headers_: "headers",
  $path_: "path",
  $query_: "query"
};
var extraPrefixes = Object.entries(extraPrefixesMap);

// src/client/core/serverSentEvents.gen.ts
function createSseClient({
  onRequest,
  onSseError,
  onSseEvent,
  responseTransformer,
  responseValidator,
  sseDefaultRetryDelay,
  sseMaxRetryAttempts,
  sseMaxRetryDelay,
  sseSleepFn,
  url,
  ...options
}) {
  let lastEventId;
  const sleep = sseSleepFn ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const createStream = async function* () {
    let retryDelay = sseDefaultRetryDelay ?? 3e3;
    let attempt = 0;
    const signal = options.signal ?? new AbortController().signal;
    while (true) {
      if (signal.aborted) break;
      attempt++;
      const headers = options.headers instanceof Headers ? options.headers : new Headers(options.headers);
      if (lastEventId !== void 0) {
        headers.set("Last-Event-ID", lastEventId);
      }
      try {
        const requestInit = {
          redirect: "follow",
          ...options,
          body: options.serializedBody,
          headers,
          signal
        };
        let request = new Request(url, requestInit);
        if (onRequest) {
          request = await onRequest(url, requestInit);
        }
        const _fetch = options.fetch ?? globalThis.fetch;
        const response = await _fetch(request);
        if (!response.ok) throw new Error(`SSE failed: ${response.status} ${response.statusText}`);
        if (!response.body) throw new Error("No body in SSE response");
        const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
        let buffer = "";
        const abortHandler = () => {
          try {
            reader.cancel();
          } catch {
          }
        };
        signal.addEventListener("abort", abortHandler);
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += value;
            buffer = buffer.replace(/\r\n?/g, "\n");
            const chunks = buffer.split("\n\n");
            buffer = chunks.pop() ?? "";
            for (const chunk of chunks) {
              const lines = chunk.split("\n");
              const dataLines = [];
              let eventName;
              for (const line of lines) {
                if (line.startsWith("data:")) {
                  dataLines.push(line.replace(/^data:\s*/, ""));
                } else if (line.startsWith("event:")) {
                  eventName = line.replace(/^event:\s*/, "");
                } else if (line.startsWith("id:")) {
                  lastEventId = line.replace(/^id:\s*/, "");
                } else if (line.startsWith("retry:")) {
                  const parsed = Number.parseInt(line.replace(/^retry:\s*/, ""), 10);
                  if (!Number.isNaN(parsed)) {
                    retryDelay = parsed;
                  }
                }
              }
              let data;
              let parsedJson = false;
              if (dataLines.length) {
                const rawData = dataLines.join("\n");
                try {
                  data = JSON.parse(rawData);
                  parsedJson = true;
                } catch {
                  data = rawData;
                }
              }
              if (parsedJson) {
                if (responseValidator) {
                  await responseValidator(data);
                }
                if (responseTransformer) {
                  data = await responseTransformer(data);
                }
              }
              onSseEvent?.({
                data,
                event: eventName,
                id: lastEventId,
                retry: retryDelay
              });
              if (dataLines.length) {
                yield data;
              }
            }
          }
        } finally {
          signal.removeEventListener("abort", abortHandler);
          reader.releaseLock();
        }
        break;
      } catch (error2) {
        onSseError?.(error2);
        if (sseMaxRetryAttempts !== void 0 && attempt >= sseMaxRetryAttempts) {
          break;
        }
        const backoff = Math.min(retryDelay * 2 ** (attempt - 1), sseMaxRetryDelay ?? 3e4);
        await sleep(backoff);
      }
    }
  };
  const stream = createStream();
  return { stream };
}

// src/client/core/pathSerializer.gen.ts
var separatorArrayExplode = (style) => {
  switch (style) {
    case "label":
      return ".";
    case "matrix":
      return ";";
    case "simple":
      return ",";
    default:
      return "&";
  }
};
var separatorArrayNoExplode = (style) => {
  switch (style) {
    case "form":
      return ",";
    case "pipeDelimited":
      return "|";
    case "spaceDelimited":
      return "%20";
    default:
      return ",";
  }
};
var separatorObjectExplode = (style) => {
  switch (style) {
    case "label":
      return ".";
    case "matrix":
      return ";";
    case "simple":
      return ",";
    default:
      return "&";
  }
};
var serializeArrayParam = ({
  allowReserved,
  explode,
  name,
  style,
  value
}) => {
  if (!explode) {
    const joinedValues2 = (allowReserved ? value : value.map((v) => encodeURIComponent(v))).join(separatorArrayNoExplode(style));
    switch (style) {
      case "label":
        return `.${joinedValues2}`;
      case "matrix":
        return `;${name}=${joinedValues2}`;
      case "simple":
        return joinedValues2;
      default:
        return `${name}=${joinedValues2}`;
    }
  }
  const separator = separatorArrayExplode(style);
  const joinedValues = value.map((v) => {
    if (style === "label" || style === "simple") {
      return allowReserved ? v : encodeURIComponent(v);
    }
    return serializePrimitiveParam({
      allowReserved,
      name,
      value: v
    });
  }).join(separator);
  return style === "label" || style === "matrix" ? separator + joinedValues : joinedValues;
};
var serializePrimitiveParam = ({
  allowReserved,
  name,
  value
}) => {
  if (value === void 0 || value === null) {
    return "";
  }
  if (typeof value === "object") {
    throw new Error(
      "Deeply-nested arrays/objects aren\u2019t supported. Provide your own `querySerializer()` to handle these."
    );
  }
  return `${name}=${allowReserved ? value : encodeURIComponent(value)}`;
};
var serializeObjectParam = ({
  allowReserved,
  explode,
  name,
  style,
  value,
  valueOnly
}) => {
  if (value instanceof Date) {
    return valueOnly ? value.toISOString() : `${name}=${value.toISOString()}`;
  }
  if (style !== "deepObject" && !explode) {
    let values = [];
    Object.entries(value).forEach(([key, v]) => {
      values = [...values, key, allowReserved ? v : encodeURIComponent(v)];
    });
    const joinedValues2 = values.join(",");
    switch (style) {
      case "form":
        return `${name}=${joinedValues2}`;
      case "label":
        return `.${joinedValues2}`;
      case "matrix":
        return `;${name}=${joinedValues2}`;
      default:
        return joinedValues2;
    }
  }
  const separator = separatorObjectExplode(style);
  const joinedValues = Object.entries(value).map(
    ([key, v]) => serializePrimitiveParam({
      allowReserved,
      name: style === "deepObject" ? `${name}[${key}]` : key,
      value: v
    })
  ).join(separator);
  return style === "label" || style === "matrix" ? separator + joinedValues : joinedValues;
};

// src/client/core/utils.gen.ts
var PATH_PARAM_RE = /\{[^{}]+\}/g;
var defaultPathSerializer = ({ path, url: _url }) => {
  let url = _url;
  const matches = _url.match(PATH_PARAM_RE);
  if (matches) {
    for (const match of matches) {
      let explode = false;
      let name = match.substring(1, match.length - 1);
      let style = "simple";
      if (name.endsWith("*")) {
        explode = true;
        name = name.substring(0, name.length - 1);
      }
      if (name.startsWith(".")) {
        name = name.substring(1);
        style = "label";
      } else if (name.startsWith(";")) {
        name = name.substring(1);
        style = "matrix";
      }
      const value = path[name];
      if (value === void 0 || value === null) {
        continue;
      }
      if (Array.isArray(value)) {
        url = url.replace(match, serializeArrayParam({ explode, name, style, value }));
        continue;
      }
      if (typeof value === "object") {
        url = url.replace(
          match,
          serializeObjectParam({
            explode,
            name,
            style,
            value,
            valueOnly: true
          })
        );
        continue;
      }
      if (style === "matrix") {
        url = url.replace(
          match,
          `;${serializePrimitiveParam({
            name,
            value
          })}`
        );
        continue;
      }
      const replaceValue = encodeURIComponent(
        style === "label" ? `.${value}` : value
      );
      url = url.replace(match, replaceValue);
    }
  }
  return url;
};
var getUrl = ({
  baseUrl,
  path,
  query,
  querySerializer,
  url: _url
}) => {
  const pathUrl = _url.startsWith("/") ? _url : `/${_url}`;
  let url = (baseUrl ?? "") + pathUrl;
  if (path) {
    url = defaultPathSerializer({ path, url });
  }
  let search = query ? querySerializer(query) : "";
  if (search.startsWith("?")) {
    search = search.substring(1);
  }
  if (search) {
    url += `?${search}`;
  }
  return url;
};
function getValidRequestBody(options) {
  const hasBody = options.body !== void 0;
  const isSerializedBody = hasBody && options.bodySerializer;
  if (isSerializedBody) {
    if ("serializedBody" in options) {
      const hasSerializedBody = options.serializedBody !== void 0 && options.serializedBody !== "";
      return hasSerializedBody ? options.serializedBody : null;
    }
    return options.body !== "" ? options.body : null;
  }
  if (hasBody) {
    return options.body;
  }
  return void 0;
}

// src/client/core/auth.gen.ts
var getAuthToken = async (auth2, callback) => {
  const token = typeof callback === "function" ? await callback(auth2) : callback;
  if (!token) {
    return;
  }
  if (auth2.scheme === "bearer") {
    return `Bearer ${token}`;
  }
  if (auth2.scheme === "basic") {
    return `Basic ${btoa(token)}`;
  }
  return token;
};

// src/client/client/utils.gen.ts
var createQuerySerializer = ({
  parameters = {},
  ...args
} = {}) => {
  const querySerializer = (queryParams) => {
    const search = [];
    if (queryParams && typeof queryParams === "object") {
      for (const name in queryParams) {
        const value = queryParams[name];
        if (value === void 0 || value === null) {
          continue;
        }
        const options = parameters[name] || args;
        if (Array.isArray(value)) {
          const serializedArray = serializeArrayParam({
            allowReserved: options.allowReserved,
            explode: true,
            name,
            style: "form",
            value,
            ...options.array
          });
          if (serializedArray) search.push(serializedArray);
        } else if (typeof value === "object") {
          const serializedObject = serializeObjectParam({
            allowReserved: options.allowReserved,
            explode: true,
            name,
            style: "deepObject",
            value,
            ...options.object
          });
          if (serializedObject) search.push(serializedObject);
        } else {
          const serializedPrimitive = serializePrimitiveParam({
            allowReserved: options.allowReserved,
            name,
            value
          });
          if (serializedPrimitive) search.push(serializedPrimitive);
        }
      }
    }
    return search.join("&");
  };
  return querySerializer;
};
var getParseAs = (contentType) => {
  if (!contentType) {
    return "stream";
  }
  const cleanContent = contentType.split(";")[0]?.trim();
  if (!cleanContent) {
    return;
  }
  if (cleanContent.startsWith("application/json") || cleanContent.endsWith("+json")) {
    return "json";
  }
  if (cleanContent === "multipart/form-data") {
    return "formData";
  }
  if (["application/", "audio/", "image/", "video/"].some((type) => cleanContent.startsWith(type))) {
    return "blob";
  }
  if (cleanContent.startsWith("text/")) {
    return "text";
  }
  return;
};
var checkForExistence = (options, name) => {
  if (!name) {
    return false;
  }
  if (options.headers.has(name) || options.query?.[name] || options.headers.get("Cookie")?.includes(`${name}=`)) {
    return true;
  }
  return false;
};
async function setAuthParams(options) {
  for (const auth2 of options.security ?? []) {
    if (checkForExistence(options, auth2.name)) {
      continue;
    }
    const token = await getAuthToken(auth2, options.auth);
    if (!token) {
      continue;
    }
    const name = auth2.name ?? "Authorization";
    switch (auth2.in) {
      case "query":
        if (!options.query) {
          options.query = {};
        }
        options.query[name] = token;
        break;
      case "cookie":
        options.headers.append("Cookie", `${name}=${token}`);
        break;
      case "header":
      default:
        options.headers.set(name, token);
        break;
    }
  }
}
var buildUrl = (options) => getUrl({
  baseUrl: options.baseUrl,
  path: options.path,
  query: options.query,
  querySerializer: typeof options.querySerializer === "function" ? options.querySerializer : createQuerySerializer(options.querySerializer),
  url: options.url
});
var mergeConfigs = (a, b) => {
  const config = { ...a, ...b };
  if (config.baseUrl?.endsWith("/")) {
    config.baseUrl = config.baseUrl.substring(0, config.baseUrl.length - 1);
  }
  config.headers = mergeHeaders(a.headers, b.headers);
  return config;
};
var headersEntries = (headers) => {
  const entries = [];
  headers.forEach((value, key) => {
    entries.push([key, value]);
  });
  return entries;
};
var mergeHeaders = (...headers) => {
  const mergedHeaders = new Headers();
  for (const header of headers) {
    if (!header) {
      continue;
    }
    const iterator = header instanceof Headers ? headersEntries(header) : Object.entries(header);
    for (const [key, value] of iterator) {
      if (value === null) {
        mergedHeaders.delete(key);
      } else if (Array.isArray(value)) {
        for (const v of value) {
          mergedHeaders.append(key, v);
        }
      } else if (value !== void 0) {
        mergedHeaders.set(
          key,
          typeof value === "object" ? JSON.stringify(value) : value
        );
      }
    }
  }
  return mergedHeaders;
};
var Interceptors = class {
  fns = [];
  clear() {
    this.fns = [];
  }
  eject(id) {
    const index = this.getInterceptorIndex(id);
    if (this.fns[index]) {
      this.fns[index] = null;
    }
  }
  exists(id) {
    const index = this.getInterceptorIndex(id);
    return Boolean(this.fns[index]);
  }
  getInterceptorIndex(id) {
    if (typeof id === "number") {
      return this.fns[id] ? id : -1;
    }
    return this.fns.indexOf(id);
  }
  update(id, fn) {
    const index = this.getInterceptorIndex(id);
    if (this.fns[index]) {
      this.fns[index] = fn;
      return id;
    }
    return false;
  }
  use(fn) {
    this.fns.push(fn);
    return this.fns.length - 1;
  }
};
var createInterceptors = () => ({
  error: new Interceptors(),
  request: new Interceptors(),
  response: new Interceptors()
});
var defaultQuerySerializer = createQuerySerializer({
  allowReserved: false,
  array: {
    explode: true,
    style: "form"
  },
  object: {
    explode: true,
    style: "deepObject"
  }
});
var defaultHeaders = {
  "Content-Type": "application/json"
};
var createConfig = (override = {}) => ({
  ...jsonBodySerializer,
  headers: defaultHeaders,
  parseAs: "auto",
  querySerializer: defaultQuerySerializer,
  ...override
});

// src/client/client/client.gen.ts
var createClient = (config = {}) => {
  let _config = mergeConfigs(createConfig(), config);
  const getConfig = () => ({ ..._config });
  const setConfig = (config2) => {
    _config = mergeConfigs(_config, config2);
    return getConfig();
  };
  const interceptors = createInterceptors();
  const beforeRequest = async (options) => {
    const opts = {
      ..._config,
      ...options,
      fetch: options.fetch ?? _config.fetch ?? globalThis.fetch,
      headers: mergeHeaders(_config.headers, options.headers),
      serializedBody: void 0
    };
    if (opts.security) {
      await setAuthParams(opts);
    }
    if (opts.requestValidator) {
      await opts.requestValidator(opts);
    }
    if (opts.body !== void 0 && opts.bodySerializer) {
      opts.serializedBody = opts.bodySerializer(opts.body);
    }
    if (opts.body === void 0 || opts.serializedBody === "") {
      opts.headers.delete("Content-Type");
    }
    const resolvedOpts = opts;
    const url = buildUrl(resolvedOpts);
    return { opts: resolvedOpts, url };
  };
  const request = async (options) => {
    const throwOnError = options.throwOnError ?? _config.throwOnError;
    const responseStyle = options.responseStyle ?? _config.responseStyle;
    let request2;
    let response;
    try {
      const { opts, url } = await beforeRequest(options);
      const requestInit = {
        redirect: "follow",
        ...opts,
        body: getValidRequestBody(opts)
      };
      request2 = new Request(url, requestInit);
      for (const fn of interceptors.request.fns) {
        if (fn) {
          request2 = await fn(request2, opts);
        }
      }
      const _fetch = opts.fetch;
      response = await _fetch(request2);
      for (const fn of interceptors.response.fns) {
        if (fn) {
          response = await fn(response, request2, opts);
        }
      }
      const result = {
        request: request2,
        response
      };
      if (response.ok) {
        const parseAs = (opts.parseAs === "auto" ? getParseAs(response.headers.get("Content-Type")) : opts.parseAs) ?? "json";
        if (response.status === 204 || response.headers.get("Content-Length") === "0") {
          let emptyData;
          switch (parseAs) {
            case "arrayBuffer":
            case "blob":
            case "text":
              emptyData = await response[parseAs]();
              break;
            case "formData":
              emptyData = new FormData();
              break;
            case "stream":
              emptyData = response.body;
              break;
            case "json":
            default:
              emptyData = {};
              break;
          }
          return opts.responseStyle === "data" ? emptyData : {
            data: emptyData,
            ...result
          };
        }
        let data;
        switch (parseAs) {
          case "arrayBuffer":
          case "blob":
          case "formData":
          case "text":
            data = await response[parseAs]();
            break;
          case "json": {
            const text = await response.text();
            data = text ? JSON.parse(text) : {};
            break;
          }
          case "stream":
            return opts.responseStyle === "data" ? response.body : {
              data: response.body,
              ...result
            };
        }
        if (parseAs === "json") {
          if (opts.responseValidator) {
            await opts.responseValidator(data);
          }
          if (opts.responseTransformer) {
            data = await opts.responseTransformer(data);
          }
        }
        return opts.responseStyle === "data" ? data : {
          data,
          ...result
        };
      }
      const textError = await response.text();
      let jsonError;
      try {
        jsonError = JSON.parse(textError);
      } catch {
      }
      throw jsonError ?? textError;
    } catch (error2) {
      let finalError = error2;
      for (const fn of interceptors.error.fns) {
        if (fn) {
          finalError = await fn(finalError, response, request2, options);
        }
      }
      finalError = finalError || {};
      if (throwOnError) {
        throw finalError;
      }
      return responseStyle === "data" ? void 0 : {
        error: finalError,
        request: request2,
        response
      };
    }
  };
  const makeMethodFn = (method) => (options) => request({ ...options, method });
  const makeSseFn = (method) => async (options) => {
    const { opts, url } = await beforeRequest(options);
    return createSseClient({
      ...opts,
      body: opts.body,
      method,
      onRequest: async (url2, init) => {
        let request2 = new Request(url2, init);
        for (const fn of interceptors.request.fns) {
          if (fn) {
            request2 = await fn(request2, opts);
          }
        }
        return request2;
      },
      serializedBody: getValidRequestBody(opts),
      url
    });
  };
  const _buildUrl = (options) => buildUrl({ ..._config, ...options });
  return {
    buildUrl: _buildUrl,
    connect: makeMethodFn("CONNECT"),
    delete: makeMethodFn("DELETE"),
    get: makeMethodFn("GET"),
    getConfig,
    head: makeMethodFn("HEAD"),
    interceptors,
    options: makeMethodFn("OPTIONS"),
    patch: makeMethodFn("PATCH"),
    post: makeMethodFn("POST"),
    put: makeMethodFn("PUT"),
    request,
    setConfig,
    sse: {
      connect: makeSseFn("CONNECT"),
      delete: makeSseFn("DELETE"),
      get: makeSseFn("GET"),
      head: makeSseFn("HEAD"),
      options: makeSseFn("OPTIONS"),
      patch: makeSseFn("PATCH"),
      post: makeSseFn("POST"),
      put: makeSseFn("PUT"),
      trace: makeSseFn("TRACE")
    },
    trace: makeMethodFn("TRACE")
  };
};

// src/client/client.gen.ts
var client = createClient(createConfig({ baseUrl: "https://jira.dev.apwide.com/rest/apwide/tem/1.1", throwOnError: true }));

// src/client/sdk.gen.ts
var ApplicationService = class {
  /**
   * Create a new application
   */
  static postApplication(options) {
    return (options.client ?? client).post({
      responseStyle: "data",
      url: "/application",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers
      }
    });
  }
  /**
   * Delete an application
   */
  static deleteApplicationById(options) {
    return (options.client ?? client).delete({
      responseStyle: "data",
      url: "/application/{id}",
      ...options
    });
  }
  /**
   * Get an application
   */
  static getApplicationById(options) {
    return (options.client ?? client).get({
      responseStyle: "data",
      url: "/application/{id}",
      ...options
    });
  }
  /**
   * Update an application
   *
   * # Updating an application
   * Updating an application can be done in patch style mode. For example:
   * * select an id
   * * provide the id in the URL
   * * call the method
   */
  static putApplicationById(options) {
    return (options.client ?? client).put({
      responseStyle: "data",
      url: "/application/{id}",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers
      }
    });
  }
  /**
   * Find applications
   */
  static getApplications(options) {
    return (options?.client ?? client).get({
      responseStyle: "data",
      url: "/applications",
      ...options
    });
  }
};
var VersionService = class {
  /**
   * Create and Update Jira Versions
   */
  static postVersion(options) {
    return (options.client ?? client).post({
      responseStyle: "data",
      url: "/version",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers
      }
    });
  }
};
var EnvironmentService = class {
  /**
   * Get an environment by application and category
   */
  static getEnvironment(options) {
    return (options.client ?? client).get({
      responseStyle: "data",
      url: "/environment",
      ...options
    });
  }
  /**
   * Create a new environment
   */
  static postEnvironment(options) {
    return (options.client ?? client).post({
      responseStyle: "data",
      url: "/environment",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers
      }
    });
  }
  /**
   * Clone environment
   */
  static postEnvironmentClone(options) {
    return (options.client ?? client).post({
      responseStyle: "data",
      url: "/environment/clone",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers
      }
    });
  }
  /**
   * Delete environment
   */
  static deleteEnvironmentById(options) {
    return (options.client ?? client).delete({
      responseStyle: "data",
      url: "/environment/{id}",
      ...options
    });
  }
  /**
   * Get an environment by id
   */
  static getEnvironmentById(options) {
    return (options.client ?? client).get({
      responseStyle: "data",
      url: "/environment/{id}",
      ...options
    });
  }
  /**
   * Update an environment
   */
  static putEnvironmentById(options) {
    return (options.client ?? client).put({
      responseStyle: "data",
      url: "/environment/{id}",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers
      }
    });
  }
  /**
   * Create and Push Environment Information
   */
  static postEnvironmentInformation(options) {
    return (options.client ?? client).post({
      responseStyle: "data",
      url: "/environment/information",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers
      }
    });
  }
  /**
   * Search environments by query parameters
   *
   * Combine any pre-defined <b>search parameters listed below</b>
   * and pass them to url as query parameters. <br/><br/>Other parameters you can
   * use:<br/>* parameters with no value to perform a <b>free text search</b> on
   * all information of your environments (ex: <i>?Staging&eCommerce&RedHat</i>)<br/>*
   * name of an <b>attribute as query parameter</b> (ex: <i>?OS=RedHat&database=Postgresql</i>)<br/><br/>Note
   * that you can send the same parameter <b>multiple times</b> with different
   * values (ex: <i>?applicationName=eCommerce&applicationName=PaymentService</i>).
   * It will return environments matching at least one of the values'
   *
   *
   * @deprecated
   */
  static getEnvironmentsSearch(options) {
    return (options?.client ?? client).get({
      responseStyle: "data",
      url: "/environments/search",
      ...options
    });
  }
  /**
   * Search environments by search filter object
   *
   * You can use the same search criteria as the 'GET' version of <i>/environments/search</i>
   * in a JSON object to trigger the search. <br/>Please refer to documentation
   * of the 'GET' version of <i>/environments/search</i>  to get the list of available
   * criteria.
   *
   *
   * @deprecated
   */
  static postEnvironmentsSearch(options) {
    return (options.client ?? client).post({
      responseStyle: "data",
      url: "/environments/search",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers
      }
    });
  }
  /**
   * Search environments by query parameters
   *
   * Combine any pre-defined <b>search parameters listed below</b>
   * and pass them to url as query parameters. <br/><br/>Other parameters you can
   * use:<br/>* parameters with no value to perform a <b>free text search</b> on
   * all information of your environments (ex: <i>?Staging&eCommerce&RedHat</i>)<br/>*
   * name of an <b>attribute as query parameter</b> (ex: <i>?OS=RedHat&database=Postgresql</i>)<br/><br/>Note
   * that you can send the same parameter <b>multiple times</b> with different
   * values (ex: <i>?applicationName=eCommerce&applicationName=PaymentService</i>).
   * It will return environments matching at least one of the values
   *
   */
  static getEnvironmentsSearchPaginated(options) {
    return (options?.client ?? client).get({
      responseStyle: "data",
      url: "/environments/search/paginated",
      ...options
    });
  }
  /**
   * Search environments by search filter object
   *
   * You can use the same search criteria as the 'GET' version of <i>/environments/search/paginated</i>
   * in a JSON object to trigger the search. <br/>Please refer to documentation
   * of the 'GET' version of <i>/environments/search/paginated</i>  to get the
   * list of available criteria.
   *
   */
  static postEnvironmentsSearchPaginated(options) {
    return (options.client ?? client).post({
      responseStyle: "data",
      url: "/environments/search/paginated",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers
      }
    });
  }
};

// src/core/GoliveClient.ts
import { debug, error } from "@actions/core";
function goliveConfig() {
  return {
    goliveToken: getString("goliveToken"),
    goliveUrl: getString("goliveUrl"),
    goliveUsername: getString("goliveUsername"),
    golivePassword: getString("golivePassword")
  };
}
function auth({ goliveToken, goliveUsername, golivePassword }) {
  if (goliveUsername) {
    const auth2 = `${goliveUsername}:${golivePassword}`;
    const b64Auth = Buffer.from(auth2).toString("base64");
    return {
      Authorization: `Basic ${b64Auth}`
    };
  } else if (goliveToken) {
    return {
      Authorization: `Bearer ${goliveToken}`
    };
  } else {
    return {};
  }
}
function setupGolive({ goliveUrl, ...authConfig }) {
  client.setConfig({
    baseUrl: goliveUrl || "https://golive.apwide.net/api",
    headers: {
      ...client.getConfig().headers || {},
      ...auth(authConfig)
    }
  });
}
function removeUndefined(obj) {
  const payload = obj;
  Object.keys(payload).forEach((key) => {
    payload[key] === void 0 && delete payload[key];
    if (typeof payload[key] === "object") {
      removeUndefined(payload[key]);
    }
  });
  return payload;
}
function isErrorCollection(error2) {
  return error2?.errorMessages || error2?.errors || error2?.status;
}
async function handleError(request, f) {
  try {
    return await f();
  } catch (e) {
    if (isErrorCollection(e)) {
      error(`
        Golive error:
        - request body: ${s(request)}
        - status: ${e.status}
        - response body: ${s(e)}
        `);
    } else {
      error("non-ApiError thrown");
    }
    throw e;
  }
}
var GoliveClient = class {
  constructor(config) {
    setupGolive(config);
  }
  async sendEnvironmentInfo(info4) {
    debug("sending environment info");
    return handleError(
      info4,
      () => EnvironmentService.postEnvironmentInformation({
        body: removeUndefined(info4)
      })
    );
  }
  async sendReleaseInfo(info4) {
    debug("sending release info");
    return handleError(
      info4,
      () => VersionService.postVersion({
        body: removeUndefined(info4)
      })
    );
  }
  async getApplicationByName(appName) {
    const apps = await ApplicationService.getApplications();
    return apps.find((app) => app.name === appName);
  }
  async createApplication(name) {
    return ApplicationService.postApplication({ body: { name } });
  }
};

// src/core/GithubClient.ts
import { context, getOctokit } from "@actions/github";
import { debug as debug2 } from "@actions/core";
function githubConfig() {
  return {
    githubToken: getString("githubToken", true)
  };
}
function getCurrentBranch() {
  return context.ref.replaceAll("/refs/heads/", "");
}
var MAX_RUNS_PER_PAGE = 100;
var GithubClient = class {
  octokit;
  constructor({ githubToken }) {
    this.octokit = getOctokit(githubToken);
  }
  get client() {
    return this.octokit.rest;
  }
  async getAllRunsSinceLastSuccess() {
    const branch = getCurrentBranch();
    const scope = [];
    let page = 1;
    let foundBoundary = false;
    let lastLoadedItems = MAX_RUNS_PER_PAGE;
    let itemsTotal = MAX_RUNS_PER_PAGE + 1;
    debug2(`loading current run detail for run id ${context.runId}`);
    const currentRun = await this.client.actions.getWorkflowRun({
      ...context.repo,
      run_id: context.runId
    });
    const params = {
      branch,
      ...context.repo,
      workflow_id: currentRun.data.workflow_id
    };
    debug2(`load last runs since last successful for params: ${JSON.stringify(params)}`);
    while (!foundBoundary && lastLoadedItems === MAX_RUNS_PER_PAGE && page * MAX_RUNS_PER_PAGE < itemsTotal) {
      const runs = await this.client.actions.listWorkflowRuns({
        ...params,
        page,
        per_page: MAX_RUNS_PER_PAGE
      });
      page++;
      lastLoadedItems = runs.data.workflow_runs.length;
      itemsTotal = runs.data.total_count;
      for (const run of runs.data.workflow_runs) {
        if (run.conclusion !== "success") {
          scope.push({
            id: run.id,
            title: run.display_title,
            commitId: run.head_commit?.id,
            commitMessage: run.head_commit?.message
            // run.head_commit?.tree_id ??
          });
        } else {
          foundBoundary = true;
          break;
        }
      }
    }
    return scope;
  }
};

// src/sendEnvironmentInfo/input.ts
function parseInput() {
  return {
    ...goliveConfig(),
    ...githubConfig(),
    targetEnvironmentId: getNumber("targetEnvironmentId"),
    targetEnvironmentName: getString("targetEnvironmentName"),
    targetEnvironmentAutoCreate: getBoolean("targetEnvironmentAutoCreate"),
    targetCategoryName: getString("targetCategoryName"),
    targetCategoryId: getNumber("targetCategoryId"),
    targetCategoryAutoCreate: getBoolean("targetCategoryAutoCreate"),
    targetApplicationId: getNumber("targetApplicationId"),
    targetApplicationName: getString("targetApplicationName"),
    targetApplicationAutoCreate: getBoolean("targetApplicationAutoCreate"),
    environmentStatusId: getNumber("environmentStatusId"),
    environmentStatusName: getString("environmentStatusName"),
    environmentUrl: getString("environmentUrl"),
    environmentAttributes: getAttributes("environmentAttributes"),
    deploymentVersionName: getString("deploymentVersionName"),
    deploymentDeployedDate: getString("deploymentDeployedDate"),
    deploymentBuildNumber: getString("deploymentBuildNumber"),
    deploymentDescription: getString("deploymentDescription"),
    deploymentIssueKeys: getIssueKeys("deploymentIssueKeys"),
    deploymentIssueKeysFromCommitHistory: getBoolean("deploymentIssueKeysFromCommitHistory", false),
    deploymentIssuesFromJql: getString("deploymentIssuesFromJql"),
    deploymentAttributes: getAttributes("deploymentAttributes"),
    deploymentSendJiraNotification: getBoolean("deploymentSendJiraNotification", false),
    deploymentAddDoneIssuesOfJiraVersion: getBoolean("deploymentAddDoneIssuesOfJiraVersion", false),
    deploymentNoFixVersionUpdate: getBoolean("deploymentNoFixVersionUpdate", false)
  };
}

// src/core/scope.ts
import { debug as debug3, info } from "@actions/core";
import { execSync } from "child_process";
import { context as context2 } from "@actions/github";
async function findIssueKeys({ githubToken }) {
  debug3("looking for issue keys");
  const githubClient = new GithubClient({ githubToken });
  const runs = await githubClient.getAllRunsSinceLastSuccess();
  debug3(`found ${runs.length} runs to process`);
  return unique([...extractIssueKeysFromCli(runs), ...extractIssueKeysFromRuns(runs)]);
}
function extractIssueKeysFromCli(runs) {
  const fromCommitId = context2.sha;
  const oldestRun = runs.length > 0 ? runs[runs.length - 1] : null;
  const toCommitId = oldestRun?.commitId || fromCommitId;
  const issueKeys = fromCli(fromCommitId, toCommitId);
  debug3(`found issues '${issueKeys}' with CLI in commits ${fromCommitId}..${toCommitId}`);
  return issueKeys;
}
function fromCli(fromCommitId, toCommitId) {
  try {
    info("Extract commits from git CLI");
    let issueKeys = [];
    if (fromCommitId == toCommitId) {
      debug3("fromCommit equals toCommit, use different strategy");
      const commitCount = Number(execSync("git rev-list HEAD --count").toString());
      if (commitCount == 1) {
        debug3("Only 1 commits, search for entire git log");
        const logs = execSync(`git log --format="%s %b"`).toString();
        issueKeys = extractIssueKeys(logs);
      } else {
        debug3(`Search in git log with HEAD~1..HEAD`);
        const logs = execSync(`git log "HEAD~1..HEAD" --format="%s %b"`).toString();
        issueKeys = extractIssueKeys(logs);
      }
    } else {
      const logs = execSync(`git log "${fromCommitId}..HEAD" --format="%s %b"`).toString();
      issueKeys = extractIssueKeys(logs);
    }
    info(`Issue keys found in commits from CLI: ${issueKeys}`);
    return issueKeys;
  } catch (error2) {
    info("Not able to parse git log (are you in shallow checkout ?)");
    debug3(`Error when parsing git repository was: ${error2}`);
    return [];
  }
}
function extractIssueKeysFromRuns(runs) {
  const issueKeys = extractIssueKeys(runs.map((run) => `${run.title} ${run.commitMessage}`).join(" "));
  debug3(`found issues '${issueKeys}' in runs detail`);
  return issueKeys;
}

// src/sendEnvironmentInfo/index.ts
async function toDeployment(input) {
  const issueKeys = input.deploymentIssueKeysFromCommitHistory ? await findIssueKeys(input) : [];
  info2(`found issues '${issueKeys}'`);
  if (!input.deploymentVersionName && !input.deploymentAttributes && !input.deploymentBuildNumber && !input.deploymentDescription && !issueKeys.length) {
    return void 0;
  }
  return {
    versionName: input.deploymentVersionName,
    attributes: input.deploymentAttributes,
    buildNumber: input.deploymentBuildNumber,
    deployedDate: input.deploymentDeployedDate,
    description: input.deploymentDescription,
    issues: {
      issueKeys: issueKeys.length ? issueKeys : void 0,
      jql: input.deploymentIssuesFromJql,
      noFixVersionUpdate: input.deploymentNoFixVersionUpdate,
      addDoneIssuesFixedInVersion: input.deploymentAddDoneIssuesOfJiraVersion,
      sendJiraNotification: input.deploymentSendJiraNotification
    }
  };
}
function toStatus({
  environmentStatusId,
  environmentStatusName
}) {
  if (!environmentStatusId && !environmentStatusName) {
    return void 0;
  }
  return {
    id: environmentStatusId,
    name: environmentStatusName
  };
}
function toEnvironment({ environmentUrl, environmentAttributes }) {
  if (!environmentUrl && !Object.keys(environmentAttributes || {}).length) {
    return {};
  }
  return {
    url: environmentUrl,
    attributes: environmentAttributes
  };
}
async function sendEnvironmentInfo() {
  try {
    const input = parseInput();
    debug4(`inputs are: ${JSON.stringify(input)}`);
    const goliveClient = new GoliveClient(input);
    const deployment = await toDeployment(input);
    const status = toStatus(input);
    const environment = toEnvironment(input);
    await goliveClient.sendEnvironmentInfo({
      environmentSelector: {
        environment: {
          id: input.targetEnvironmentId,
          name: input.targetEnvironmentName,
          autoCreate: input.targetEnvironmentAutoCreate
        },
        application: {
          id: input.targetApplicationId,
          name: input.targetApplicationName,
          autoCreate: input.targetApplicationAutoCreate
        },
        category: {
          id: input.targetCategoryId,
          name: input.targetCategoryName,
          autoCreate: input.targetCategoryAutoCreate
        }
      },
      environment,
      status,
      deployment
    });
    setOutput("status", "success");
  } catch (error2) {
    if (error2 instanceof Error) {
      setFailed(error2.message);
    }
    setOutput("status", "failed");
  }
}

// src/sendReleaseInfo/input.ts
import { debug as debug5 } from "@actions/core";
function sendReleaseInfoInput() {
  const inputs = {
    ...goliveConfig(),
    ...githubConfig(),
    targetAutoCreate: getBoolean("targetAutoCreate"),
    targetApplicationId: getNumber("targetApplicationId"),
    targetApplicationName: getString("targetApplicationName"),
    versionName: getString("versionName"),
    versionDescription: getString("versionDescription"),
    versionStartDate: getString("versionStartDate"),
    versionReleaseDate: getString("versionReleaseDate"),
    versionReleased: getBoolean("versionReleased"),
    issueKeys: getIssueKeys("issueKeys"),
    issueKeysFromCommitHistory: getBoolean("issueKeysFromCommitHistory", false),
    issuesFromJql: getString("issuesFromJql"),
    sendJiraNotification: getBoolean("sendJiraNotification")
  };
  if (!inputs.targetApplicationId && !inputs.targetApplicationName) {
    throw new Error("At least one of applicationId/applicationName must be provided");
  }
  debug5(`inputs are: ${JSON.stringify(inputs)}`);
  return inputs;
}

// src/sendReleaseInfo/index.ts
import { info as info3, setFailed as setFailed2, setOutput as setOutput2 } from "@actions/core";
async function getTargetApplicationId(golive, { targetApplicationId, targetApplicationName, targetAutoCreate }) {
  if (targetApplicationId) {
    return targetApplicationId;
  }
  if (!targetApplicationName?.length) {
    throw new Error(
      "Not able to identify application because none of targetApplicationId/targetApplicationName have been provided"
    );
  }
  let application = await golive.getApplicationByName(targetApplicationName);
  info3(`Found application ${s(application)}`);
  if (application) {
    return application.id;
  }
  if (!targetAutoCreate) {
    throw new Error(
      `no application id provided, not able to find application for name ${targetApplicationName} and targetAutoCreate set to false`
    );
  }
  info3(`Create application with name ${targetApplicationName}`);
  application = await golive.createApplication(targetApplicationName);
  info3(`Application created with id ${application.id}`);
  return application.id;
}
async function loadIssueKeys(inputs) {
  let issueKeys = [];
  if (inputs.issueKeys) {
    info3("loading issue keys from input");
    issueKeys = [...issueKeys, ...inputs.issueKeys];
  }
  if (inputs.issueKeysFromCommitHistory) {
    issueKeys = [...issueKeys, ...await findIssueKeys(inputs)];
  }
  const found = unique(issueKeys);
  info3(`found issue keys ${found}`);
  return found;
}
async function sendReleaseInfo() {
  console.log("inside sendReleaseInfo");
  try {
    const input = sendReleaseInfoInput();
    const golive = new GoliveClient(input);
    const applicationId = await getTargetApplicationId(golive, input);
    await golive.sendReleaseInfo({
      application: {
        id: applicationId
      },
      versionDescription: input.versionDescription,
      versionName: input.versionName,
      startDate: input.versionStartDate,
      releaseDate: input.versionReleaseDate,
      released: input.versionReleased,
      issues: {
        issueKeys: await loadIssueKeys(input),
        jql: input.issuesFromJql,
        sendJiraNotification: input.sendJiraNotification
      }
    });
    setOutput2("status", "success");
  } catch (e) {
    setFailed2(e instanceof Error ? e.message : String(e));
    setOutput2("status", "failed");
  }
}
export {
  sendEnvironmentInfo,
  sendReleaseInfo
};
