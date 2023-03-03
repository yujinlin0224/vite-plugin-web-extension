var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};

// src/plugins/manifest-loader-plugin.ts
import * as vite3 from "vite";

// src/constants.ts
var MANIFEST_LOADER_PLUGIN_NAME = `web-extension:manifest`;
var LABELED_STEP_PLUGIN_NAME = `web-extension:labeled-step`;
var MULTIBUILD_COMPLETE_PLUGIN_NAME = `web-extension:multibuild`;
var BUNDLE_TRACKER_PLUGIN_NAME = `web-extension:bundle-tracker`;
var HMR_REWRITE_PLUGIN_NAME = `web-extension:hmr-rewrite`;

// src/logger.ts
var RESET = "\x1B[0m";
var BOLD = "\x1B[1m";
var DIM = "\x1B[2m";
var RED = "\x1B[91m";
var GREEN = "\x1B[92m";
var YELLOW = "\x1B[93m";
var BLUE = "\x1B[94m";
var VIOLET = "\x1B[95m";
var CYAN = "\x1B[96m";
function createLogger(verbose, disableColor) {
  if (disableColor) {
    RESET = "";
    BOLD = "";
    DIM = "";
    RED = "";
    GREEN = "";
    YELLOW = "";
    BLUE = "";
    VIOLET = "";
    CYAN = "";
  }
  return {
    verbose(message) {
      if (!verbose)
        return;
      console.debug(
        message.split("\n").map(
          (line) => `  ${BOLD}${DIM}${MANIFEST_LOADER_PLUGIN_NAME}${RESET} ${line}`
        ).join("\n")
      );
    },
    log(message) {
      console.log(message);
    },
    warn(message) {
      console.warn(
        message.split("\n").map(
          (line) => `${BOLD}${YELLOW}[${MANIFEST_LOADER_PLUGIN_NAME}] WARN: ${line}${RESET}`
        ).join("\n")
      );
    },
    error(message, err) {
      console.error(
        message.split("\n").map(
          (line) => `${BOLD}${RED}[${MANIFEST_LOADER_PLUGIN_NAME}] ERROR: ${line}${RESET}`
        ).join("\n")
      );
      console.error(err);
    }
  };
}

// src/build/build-context.ts
import { inspect as inspect2 } from "util";
import * as vite2 from "vite";

// src/utils.ts
import path from "path";
function compact(array) {
  return array.filter((item) => item != null);
}
function trimExtension(filename) {
  return filename == null ? void 0 : filename.replace(path.extname(filename), "");
}
function colorizeFilename(filename) {
  let color = CYAN;
  if (filename.match(/\.(html|pug)$/))
    color = GREEN;
  if (filename.match(/\.(css|scss|stylus|sass|png|jpg|jpeg|webp|webm|svg|ico)$/))
    color = VIOLET;
  return `${color}${filename}${RESET}`;
}
function defineNoRollupInput() {
  const tempId = "virtual:temp.js";
  const tempResolvedId = "\0" + tempId;
  const tempContent = "export const temp = true;";
  return {
    config: {
      build: {
        lib: {
          entry: tempId,
          formats: ["es"],
          name: tempId,
          fileName: tempId
        }
      }
    },
    resolveId(id) {
      if (id.includes(tempId))
        return tempResolvedId;
    },
    load(id) {
      if (id === tempResolvedId)
        return tempContent;
    },
    cleanupBundle(bundle) {
      const tempAsset = Object.entries(bundle).find(
        ([_, asset]) => asset.type === "chunk" && asset.facadeModuleId === tempResolvedId
      ) ?? [];
      if ((tempAsset == null ? void 0 : tempAsset[0]) && bundle[tempAsset[0]])
        delete bundle[tempAsset[0]];
    }
  };
}
function getRootDir(config) {
  const cwd = process.cwd();
  const configFileDir = config.configFile ? path.resolve(cwd, config.configFile) : cwd;
  return path.resolve(configFileDir, config.root);
}
function getOutDir(config) {
  const { outDir } = config.build;
  return path.resolve(getRootDir(config), outDir);
}
function getPublicDir(config) {
  if (config.publicDir === "")
    return;
  return path.resolve(getRootDir(config), config.publicDir ?? "public");
}
function getInputPaths(paths, input) {
  let inputs;
  if (typeof input === "string")
    inputs = [input];
  else if (Array.isArray(input))
    inputs = input;
  else if ("entry" in input)
    inputs = [input.entry];
  else
    inputs = Object.values(input);
  return inputs.map((file) => {
    if (path.isAbsolute(file))
      return path.relative(paths.rootDir, file).replace(/\\/g, "/");
    return file.replace(/\\/g, "/");
  });
}
async function removePlugin(plugins, pluginNameToRemove) {
  if (!plugins)
    return plugins;
  const newPlugins = [];
  for (const itemPromise of plugins) {
    const item = await itemPromise;
    if (Array.isArray(item))
      newPlugins.push(await removePlugin(item, pluginNameToRemove));
    else if (!item || item.name !== pluginNameToRemove)
      newPlugins.push(item);
  }
  return newPlugins;
}
function resolveBrowserTagsInObject(browser, object) {
  if (Array.isArray(object)) {
    return object.map((item) => resolveBrowserTagsInObject(browser, item)).filter((item) => !!item);
  } else if (typeof object === "object") {
    return Object.keys(object).reduce((newObject, key) => {
      if (!key.startsWith("{{") || key.startsWith(`{{${browser}}}.`)) {
        newObject[key.replace(`{{${browser}}}.`, "")] = resolveBrowserTagsInObject(browser, object[key]);
      }
      return newObject;
    }, {});
  } else if (typeof object === "string") {
    if (!object.startsWith("{{") || object.startsWith(`{{${browser}}}.`)) {
      return object.replace(`{{${browser}}}.`, "");
    }
    return void 0;
  } else {
    return object;
  }
}
function withTimeout(promise, duration) {
  return new Promise((res, rej) => {
    const timeout = setTimeout(() => {
      rej(`Promise timed out after ${duration}ms`);
    }, duration);
    promise.then(res).catch(rej).finally(() => clearTimeout(timeout));
  });
}
function getOutputFile(file) {
  return file.replace(/\.(pug)$/, ".html").replace(/\.(scss|stylus|sass)$/, ".css").replace(/\.(jsx|ts|tsx)$/, ".js");
}

// src/plugins/labeled-step-plugin.ts
function labeledStepPlugin(logger, total, index, paths) {
  let finalConfig;
  let buildCount = 0;
  function printFirstBuild() {
    var _a, _b;
    logger.log("");
    const progressLabel = `(${index + 1}/${total})`;
    const input = ((_b = (_a = finalConfig.build) == null ? void 0 : _a.rollupOptions) == null ? void 0 : _b.input) || finalConfig.build.lib;
    if (!input) {
      logger.warn(`Building unknown config ${progressLabel}`);
      return;
    }
    const inputs = getInputPaths(paths, input);
    logger.log(
      `Building ${inputs.map(colorizeFilename).join(", ")} ${progressLabel}`
    );
  }
  function printRebuilds() {
    var _a, _b;
    const input = (_b = (_a = finalConfig.build) == null ? void 0 : _a.rollupOptions) == null ? void 0 : _b.input;
    if (input == null) {
      logger.warn("Rebuilding unknown config");
      return;
    }
    const files = getInputPaths(paths, input);
    logger.log(`Rebuilding ${files.map(colorizeFilename).join(", ")}`);
  }
  return {
    name: LABELED_STEP_PLUGIN_NAME,
    configResolved(config) {
      finalConfig = config;
      if (buildCount == 0)
        printFirstBuild();
      else
        printRebuilds();
      buildCount++;
    }
  };
}

// src/plugins/multibuild-complete-plugin.ts
import Lock from "async-lock";
function createMultibuildCompleteManager(onBuildsSucceeded) {
  let activeBuilds = 0;
  const buildStatuses = {};
  let nextBuildId = 0;
  let hasTriggeredCallback = false;
  const lock = new Lock();
  const lockKey = "builds";
  function incrementBuildCount(buildId) {
    return lock.acquire(lockKey, () => {
      activeBuilds++;
      hasTriggeredCallback = false;
      delete buildStatuses[buildId];
    });
  }
  function decreaseBuildCount(buildId, err) {
    return lock.acquire(lockKey, async () => {
      activeBuilds--;
      if (err == null)
        delete buildStatuses[buildId];
      else
        buildStatuses[buildId] = err;
    });
  }
  function checkCompleted() {
    return lock.acquire(lockKey, async () => {
      if (activeBuilds === 0 && Object.values(buildStatuses).length === 0 && !hasTriggeredCallback) {
        hasTriggeredCallback = true;
        await onBuildsSucceeded();
      }
    });
  }
  return {
    plugin() {
      const buildId = nextBuildId++;
      incrementBuildCount(buildId);
      let hasBuildOnce = false;
      return {
        name: MULTIBUILD_COMPLETE_PLUGIN_NAME,
        enforce: "post",
        async buildStart() {
          if (hasBuildOnce)
            await incrementBuildCount(buildId);
          hasBuildOnce = true;
        },
        async buildEnd(err) {
          await decreaseBuildCount(buildId, err);
        },
        async closeBundle() {
          await checkCompleted();
        }
      };
    }
  };
}

// src/plugins/bundle-tracker-plugin.ts
function bundleTrackerPlugin() {
  let chunks;
  return {
    name: BUNDLE_TRACKER_PLUGIN_NAME,
    buildStart() {
      chunks = void 0;
    },
    writeBundle(_, bundle) {
      chunks = Object.values(bundle).map((chunk) => chunk.fileName);
    },
    getChunks: () => chunks
  };
}

// src/build/getViteConfigsForInputs.ts
import path3 from "path";
import * as vite from "vite";

// src/plugins/hmr-rewrite-plugin.ts
import {
  mergeConfig
} from "vite";
import { parseHTML } from "linkedom";
import path2 from "path";
import { inspect } from "util";
function hmrRewritePlugin(config) {
  const { hmr, server, paths, logger } = config;
  let inputIds = [];
  function serializeDefine(define) {
    let res = `{`;
    for (const key in define) {
      const val = define[key];
      res += `${JSON.stringify(key)}: ${typeof val === "string" ? `(${val})` : JSON.stringify(val)}, `;
    }
    return res + `}`;
  }
  return {
    name: HMR_REWRITE_PLUGIN_NAME,
    config(config2) {
      var _a, _b;
      inputIds = Object.values(((_b = (_a = config2.build) == null ? void 0 : _a.rollupOptions) == null ? void 0 : _b.input) ?? {});
      const hmrConfig = {
        server: {
          hmr: {
            protocol: "http:",
            host: "127.0.0.1",
            port: 5173
          }
        },
        define: {
          __MODE__: JSON.stringify(config2.mode || null),
          __BASE__: JSON.stringify(server.base || "/"),
          __DEFINES__: serializeDefine(config2.define || {}),
          __SERVER_HOST__: JSON.stringify(server.host || "localhost"),
          __HMR_PROTOCOL__: JSON.stringify((hmr == null ? void 0 : hmr.protocol) || null),
          __HMR_HOSTNAME__: JSON.stringify((hmr == null ? void 0 : hmr.host) || "localhost"),
          __HMR_PORT__: JSON.stringify((hmr == null ? void 0 : hmr.clientPort) || (hmr == null ? void 0 : hmr.port) || 5173),
          __HMR_DIRECT_TARGET__: JSON.stringify(
            `${server.host ?? "localhost"}:${server.port ?? 5173}${config2.base || "/"}`
          ),
          __HMR_BASE__: JSON.stringify(server.base ?? "/"),
          __HMR_TIMEOUT__: JSON.stringify((hmr == null ? void 0 : hmr.timeout) || 3e4),
          __HMR_ENABLE_OVERLAY__: JSON.stringify((hmr == null ? void 0 : hmr.overlay) !== false)
        }
      };
      return mergeConfig(config2, hmrConfig);
    },
    transform(code, id) {
      if (!id.endsWith(".html") || !inputIds.includes(id))
        return;
      const baseUrl = "http://localhost:5173";
      const { document } = parseHTML(code);
      const pointToDevServer = (querySelector, attr) => {
        document.querySelectorAll(querySelector).forEach((element) => {
          const src = element.getAttribute(attr);
          if (!src)
            return;
          const before = element.outerHTML;
          if (path2.isAbsolute(src)) {
            element.setAttribute(attr, baseUrl + src);
          } else if (src.startsWith(".")) {
            const abs = path2.resolve(path2.dirname(id), src);
            const pathname = path2.relative(paths.rootDir, abs);
            element.setAttribute(attr, `${baseUrl}/${pathname}`);
          }
          const after = element.outerHTML;
          if (before !== after) {
            logger.verbose(
              "Transformed for dev mode: " + inspect({ before, after })
            );
          }
        });
      };
      pointToDevServer("script[type=module]", "src");
      pointToDevServer("link[rel=stylesheet]", "href");
      const clientScript = document.createElement("script");
      clientScript.type = "module";
      clientScript.src = `${baseUrl}/@vite/client`;
      document.head.append(clientScript);
      return document.toString();
    }
  };
}

// src/build/getViteConfigsForInputs.ts
var HTML_ENTRY_REGEX = /\.(html)$/;
var SCRIPT_ENTRY_REGEX = /\.(js|ts|mjs|mts)$/;
var CombinedViteConfigs = class {
  html;
  sandbox;
  scripts;
  other;
  get count() {
    return this.all.length;
  }
  get all() {
    return compact([this.html, this.sandbox, this.scripts, this.other].flat());
  }
  applyBaseConfig(baseConfig) {
    var _a, _b;
    if (this.html)
      this.html = vite.mergeConfig(baseConfig, this.html);
    if (this.sandbox)
      this.sandbox = vite.mergeConfig(baseConfig, this.sandbox);
    this.scripts = (_a = this.scripts) == null ? void 0 : _a.map(
      (config) => vite.mergeConfig(baseConfig, config)
    );
    this.other = (_b = this.other) == null ? void 0 : _b.map(
      (config) => vite.mergeConfig(baseConfig, config)
    );
  }
};
function getViteConfigsForInputs(options) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o;
  const { paths, additionalInputs, manifest, mode, logger, resolvedConfig } = options;
  const configs = new CombinedViteConfigs();
  const processedInputs = /* @__PURE__ */ new Set();
  const hasBeenProcessed = (input) => processedInputs.has(input);
  function getMultiPageConfig(entries, baseConfig) {
    const newEntries = entries.filter((entry) => !hasBeenProcessed(entry));
    newEntries.forEach((entry) => processedInputs.add(entry));
    if (newEntries.length === 0)
      return;
    const plugins = mode === 2 /* DEV */ ? [
      hmrRewritePlugin({
        server: resolvedConfig.server,
        hmr: typeof resolvedConfig.server.hmr === "object" ? resolvedConfig.server.hmr : void 0,
        paths,
        logger
      })
    ] : [];
    const inputConfig = {
      plugins,
      build: {
        rollupOptions: {
          input: newEntries.reduce((input, entry) => {
            input[trimExtension(entry)] = path3.resolve(paths.rootDir, entry);
            return input;
          }, {}),
          output: {
            entryFileNames: `[name].js`,
            chunkFileNames: `[name].js`,
            assetFileNames: ({ name }) => {
              if (!name)
                return "[name].[ext]";
              if (name && path3.isAbsolute(name)) {
                name = path3.relative(paths.rootDir, name);
              }
              return `${trimExtension(name)}.[ext]`;
            }
          }
        }
      }
    };
    return vite.mergeConfig(baseConfig, inputConfig);
  }
  function getIndividualConfig(entry, baseConfig) {
    if (hasBeenProcessed(entry))
      return;
    processedInputs.add(entry);
    const moduleId = trimExtension(entry);
    const inputConfig = {
      build: {
        watch: mode !== 0 /* BUILD */ ? {} : void 0,
        lib: {
          name: "_",
          entry,
          formats: ["iife"],
          fileName: () => moduleId + ".js"
        }
      }
    };
    return vite.mergeConfig(baseConfig, inputConfig);
  }
  function getHtmlConfig(entries) {
    return getMultiPageConfig(entries, options.baseHtmlViteConfig);
  }
  function getSandboxConfig(entries) {
    return getMultiPageConfig(entries, options.baseSandboxViteConfig);
  }
  function getScriptConfig(entry) {
    return getIndividualConfig(entry, options.baseScriptViteConfig);
  }
  function getOtherConfig(entry) {
    return getIndividualConfig(entry, options.baseOtherViteConfig);
  }
  const {
    htmlAdditionalInputs,
    otherAdditionalInputs,
    scriptAdditionalInputs
  } = separateAdditionalInputs(additionalInputs);
  const htmlEntries = simplifyEntriesList([
    (_a = manifest.action) == null ? void 0 : _a.default_popup,
    manifest.devtools_page,
    manifest.options_page,
    (_b = manifest.options_ui) == null ? void 0 : _b.page,
    (_c = manifest.browser_action) == null ? void 0 : _c.default_popup,
    (_d = manifest.page_action) == null ? void 0 : _d.default_popup,
    (_e = manifest.sidebar_action) == null ? void 0 : _e.default_panel,
    (_f = manifest.background) == null ? void 0 : _f.page,
    (_g = manifest.chrome_url_overrides) == null ? void 0 : _g.bookmarks,
    (_h = manifest.chrome_url_overrides) == null ? void 0 : _h.history,
    (_i = manifest.chrome_url_overrides) == null ? void 0 : _i.newtab,
    (_j = manifest.chrome_settings_overrides) == null ? void 0 : _j.homepage,
    htmlAdditionalInputs
  ]);
  const sandboxEntries = simplifyEntriesList([(_k = manifest.sandbox) == null ? void 0 : _k.pages]);
  configs.html = getHtmlConfig(htmlEntries);
  configs.sandbox = getSandboxConfig(sandboxEntries);
  compact(
    simplifyEntriesList([
      (_l = manifest.background) == null ? void 0 : _l.service_worker,
      (_m = manifest.background) == null ? void 0 : _m.scripts,
      (_n = manifest.content_scripts) == null ? void 0 : _n.flatMap(
        (cs) => cs.js
      ),
      scriptAdditionalInputs
    ]).map(getScriptConfig)
  ).forEach((scriptConfig) => {
    configs.scripts ?? (configs.scripts = []);
    configs.scripts.push(scriptConfig);
  });
  compact(
    simplifyEntriesList([
      (_o = manifest.content_scripts) == null ? void 0 : _o.flatMap(
        (cs) => cs.css
      ),
      otherAdditionalInputs
    ]).map(getOtherConfig)
  ).forEach((otherConfig) => {
    configs.other ?? (configs.other = []);
    configs.other.push(otherConfig);
  });
  validateCombinedViteConfigs(configs);
  return configs;
}
function separateAdditionalInputs(additionalInputs) {
  const scriptAdditionalInputs = [];
  const otherAdditionalInputs = [];
  const htmlAdditionalInputs = [];
  additionalInputs == null ? void 0 : additionalInputs.forEach((input) => {
    if (HTML_ENTRY_REGEX.test(input))
      htmlAdditionalInputs.push(input);
    else if (SCRIPT_ENTRY_REGEX.test(input))
      scriptAdditionalInputs.push(input);
    else
      scriptAdditionalInputs.push(input);
  });
  return {
    scriptAdditionalInputs,
    otherAdditionalInputs,
    htmlAdditionalInputs
  };
}
function simplifyEntriesList(a) {
  return compact((a == null ? void 0 : a.flat()) ?? []);
}
function validateCombinedViteConfigs(configs) {
  if (configs.count === 0) {
    throw Error(
      "No inputs found in manifest.json. Run Vite with `--debug` for more details."
    );
  }
}

// src/build/build-context.ts
function createBuildContext({
  pluginOptions,
  logger
}) {
  let bundles = {};
  let activeWatchers = [];
  async function getBuildConfigs({
    paths,
    userConfig,
    resolvedConfig,
    manifest,
    onSuccess,
    mode
  }) {
    const entryConfigs = getViteConfigsForInputs({
      paths,
      manifest,
      mode,
      logger,
      resolvedConfig,
      additionalInputs: pluginOptions.additionalInputs,
      baseHtmlViteConfig: pluginOptions.htmlViteConfig ?? {},
      baseSandboxViteConfig: {},
      baseScriptViteConfig: pluginOptions.scriptViteConfig ?? {},
      baseOtherViteConfig: {}
    });
    const multibuildManager = createMultibuildCompleteManager(async () => {
      if (mode == 1 /* WATCH */)
        printCompleted();
      await (onSuccess == null ? void 0 : onSuccess());
    });
    const totalEntries = entryConfigs.count;
    const getForcedConfig = (buildOrderIndex) => ({
      clearScreen: false,
      publicDir: false,
      build: { emptyOutDir: false },
      configFile: false,
      plugins: [
        labeledStepPlugin(logger, totalEntries, buildOrderIndex, paths),
        multibuildManager.plugin()
      ]
    });
    const finalConfigPromises = entryConfigs.all.map(
      (entryConfig, i) => vite2.mergeConfig(
        vite2.mergeConfig(entryConfig, userConfig),
        getForcedConfig(i)
      )
    ).map(async (config) => {
      const newPlugins = await removePlugin(
        config.plugins,
        MANIFEST_LOADER_PLUGIN_NAME
      );
      return { ...config, plugins: newPlugins };
    });
    return await Promise.all(finalConfigPromises);
  }
  function printSummary(paths, buildConfigs) {
    if (buildConfigs.length === 0)
      return;
    const lines = ["", `${BOLD}Build Steps${RESET}`];
    buildConfigs.forEach((config, i) => {
      var _a, _b, _c;
      const input = ((_b = (_a = config.build) == null ? void 0 : _a.rollupOptions) == null ? void 0 : _b.input) ?? ((_c = config.build) == null ? void 0 : _c.lib);
      if (!input)
        return;
      const inputs = getInputPaths(paths, input);
      if (inputs.length === 1) {
        lines.push(
          `  ${i + 1}. Building ${colorizeFilename(inputs[0])} indvidually`
        );
      } else {
        lines.push(
          `  ${i + 1}. Bundling ${inputs.length} entrypoints together:`
        );
        inputs.forEach(
          (relativePath) => lines.push(`    ${DIM}\u2022${RESET} ${colorizeFilename(relativePath)}`)
        );
      }
    });
    logger.log(lines.join("\n"));
  }
  function printCompleted() {
    logger.log(`
${GREEN}\u2713${RESET} All steps completed.
`);
  }
  function waitForWatchBuildComplete(watcher) {
    return new Promise((res, rej) => {
      watcher.addListener("event", async (e) => {
        switch (e.code) {
          case "END":
            res();
            break;
          case "ERROR":
            rej(e.error);
            break;
        }
      });
    });
  }
  return {
    async rebuild(rebuildOptions) {
      var _a, _b, _c;
      const { paths, mode } = rebuildOptions;
      await Promise.all(activeWatchers.map((watcher) => watcher.close()));
      activeWatchers = [];
      const buildConfigs = await getBuildConfigs(rebuildOptions);
      if (pluginOptions.printSummary)
        printSummary(paths, buildConfigs);
      logger.verbose("Final configs: " + inspect2(buildConfigs, void 0, 7));
      for (const config of buildConfigs) {
        const bundleTracker = bundleTrackerPlugin();
        (config.plugins ?? (config.plugins = [])).push(bundleTracker);
        const output = await vite2.build(config);
        if ("addListener" in output) {
          activeWatchers.push(output);
          await waitForWatchBuildComplete(output);
        }
        const input = ((_a = config.build) == null ? void 0 : _a.lib) ?? ((_c = (_b = config.build) == null ? void 0 : _b.rollupOptions) == null ? void 0 : _c.input);
        if (input) {
          const chunks = bundleTracker.getChunks() ?? [];
          for (const file of getInputPaths(paths, input)) {
            bundles[file] = chunks;
          }
        }
      }
      if (mode === 0 /* BUILD */) {
        printCompleted();
      }
    },
    getBundles() {
      return bundles;
    }
  };
}

// src/plugins/manifest-loader-plugin.ts
import path5 from "path";
import fs2 from "fs-extra";
import { inspect as inspect5 } from "util";

// src/extension-runner/web-ext-runner.ts
import * as webExtLogger from "web-ext/util/logger";
import webExt from "web-ext";
import { inspect as inspect3 } from "util";

// src/config.ts
import JSON2 from "json5";
import YAML from "yaml";
import os from "os";
import path4 from "path";
import fs from "fs/promises";
async function loadConfig({
  paths,
  logger,
  overrides
}) {
  const directories = Array.from(
    /* @__PURE__ */ new Set([paths.rootDir, process.cwd(), os.homedir()])
  );
  const parsers = {
    "": [JSON2, YAML],
    ".json": [JSON2],
    ".json5": [JSON2],
    ".yml": [YAML],
    ".yaml": [YAML]
  };
  const names = [".webextrc", "webext.config"];
  const files = {};
  directories.forEach((dir) => {
    names.forEach((name) => {
      Object.entries(parsers).forEach(([ext, parsers2]) => {
        files[path4.resolve(dir, `${name}${ext}`)] = parsers2;
      });
    });
  });
  const layers = [{ config: overrides ?? {} }];
  for (const [file, parsers2] of Object.entries(files)) {
    parsersLoop:
      for (const parser of parsers2) {
        try {
          const layer = { file, config: {} };
          const text = await fs.readFile(file, "utf-8");
          layer.config = parser.parse(text);
          if (typeof layer.config !== "object")
            throw Error("Config not an object");
          layers.push(layer);
          break parsersLoop;
        } catch (err) {
        }
      }
  }
  return {
    layers,
    config: layers.map((layer) => layer.config).reduceRight((prevConfig, nextConfig) => {
      return { ...prevConfig, ...nextConfig };
    })
  };
}

// src/extension-runner/web-ext-runner.ts
function createWebExtRunner(options) {
  const { pluginOptions, paths, logger } = options;
  let runner;
  return {
    async openBrowser() {
      webExtLogger.consoleStream.write = ({ level, msg, name }) => {
        if (level >= ERROR_LOG_LEVEL)
          logger.error(name, msg);
        if (level >= WARN_LOG_LEVEL)
          logger.warn(msg);
      };
      const config = await loadConfig2({ pluginOptions, logger, paths });
      logger.verbose("web-ext config:" + inspect3(config));
      const target = pluginOptions.browser === null || pluginOptions.browser === "firefox" ? null : "chromium";
      const sourceDir = paths.outDir;
      runner = await webExt.cmd.run(
        {
          ...config,
          target,
          sourceDir,
          noReload: true,
          noInput: true
        },
        {
          shouldExitProgram: false
        }
      );
    },
    async reload() {
      await runner.reloadAllExtensions();
      logger.log("");
    },
    async exit() {
      return runner.exit();
    }
  };
}
var WARN_LOG_LEVEL = 40;
var ERROR_LOG_LEVEL = 50;
async function loadConfig2({
  pluginOptions,
  paths,
  logger
}) {
  const res = await loadConfig({
    overrides: pluginOptions.webExtConfig,
    paths,
    logger
  });
  logger.verbose("Config result: " + inspect3(res, void 0, 3));
  return res.config;
}

// src/manifest-validation.ts
import dns from "dns";
import https from "https";
import { inspect as inspect4 } from "util";
import Ajv from "ajv";
var SCHEMA_URL = new URL("https://json.schemastore.org/chrome-manifest");
function createManifestValidator(options) {
  const { logger } = options;
  let schema;
  const ajv = new Ajv();
  ajv.addFormat("permission", /.*/);
  ajv.addFormat("content-security-policy", /.*/);
  ajv.addFormat("glob-pattern", /.*/);
  ajv.addFormat("match-pattern", /.*/);
  ajv.addFormat("mime-type", /.*/);
  function isOffline() {
    const isOffline2 = new Promise((res) => {
      dns.resolve(SCHEMA_URL.hostname, (err) => {
        if (err == null) {
          res(false);
        } else {
          logger.verbose("DNS not resolved");
          logger.verbose(inspect4(err));
          res(true);
        }
      });
    });
    return withTimeout(isOffline2, 1e3).catch(() => true);
  }
  async function loadSchema() {
    if (schema != null)
      return;
    logger.verbose(`Loading JSON schema from ${SCHEMA_URL.href}...`);
    schema = await get(SCHEMA_URL.href);
  }
  function get(url) {
    return new Promise((res, rej) => {
      https.get(url, (response) => {
        let responseBody = "";
        response.on("data", (chunk) => {
          responseBody += chunk;
        });
        response.on("end", () => {
          res(JSON.parse(responseBody));
        });
      }).on("error", (err) => rej(err));
    });
  }
  return async (manifest) => {
    if (schema == null && await isOffline())
      return logger.warn(
        "Cannot connect to json.schemastore.org, skipping validation"
      );
    logger.verbose(`Validating manifest...`);
    if (manifest == null)
      throw Error(`Manifest cannot be ${manifest}`);
    await loadSchema();
    logger.verbose(`Loaded JSON schema: ${inspect4(schema)}`);
    const success = await ajv.validate(schema, manifest);
    if (success) {
      logger.verbose("Manifest is valid");
      return;
    }
    throw Error(
      `Manifest is not valid: ${JSON.stringify(ajv.errors, null, 2)}`
    );
  };
}

// src/csp.ts
var _ContentSecurityPolicy = class {
  data;
  constructor(csp) {
    if (csp) {
      const sections = csp.split(";").map((section) => section.trim());
      this.data = sections.reduce((data, section) => {
        const [key, ...values] = section.split(" ").map((item) => item.trim());
        if (key)
          data[key] = values;
        return data;
      }, {});
    } else {
      this.data = {};
    }
  }
  add(directive, ...newValues) {
    const values = this.data[directive] ?? [];
    newValues.forEach((newValue) => {
      if (!values.includes(newValue))
        values.push(newValue);
    });
    this.data[directive] = values;
    return this;
  }
  toString() {
    const directives = Object.entries(this.data).sort(([l], [r]) => {
      const lo = _ContentSecurityPolicy.DIRECTIVE_ORDER[l] ?? 2;
      const ro = _ContentSecurityPolicy.DIRECTIVE_ORDER[r] ?? 2;
      return lo - ro;
    });
    return directives.map((entry) => entry.flat().join(" ")).join("; ") + ";";
  }
};
var ContentSecurityPolicy = _ContentSecurityPolicy;
__publicField(ContentSecurityPolicy, "DIRECTIVE_ORDER", {
  "default-src": 0,
  "script-src": 1,
  "object-src": 2
});

// src/build/renderManifest.ts
function renderManifest(input, bundles) {
  var _a, _b, _c;
  const output = JSON.parse(JSON.stringify(input));
  replaceEntrypoint(bundles, output.action, "default_popup");
  replaceEntrypoint(bundles, output, "devtools_page");
  replaceEntrypoint(bundles, output, "options_page");
  replaceEntrypoint(bundles, output.options_ui, "page");
  replaceEntrypoint(bundles, output.browser_action, "default_popup");
  replaceEntrypoint(bundles, output.page_action, "default_popup");
  replaceEntrypoint(bundles, output.sidebar_action, "default_panel");
  replaceEntrypointArray(bundles, (_a = output.sandbox) == null ? void 0 : _a.pages);
  replaceEntrypoint(bundles, output.background, "service_worker");
  replaceEntrypoint(bundles, output.background, "page");
  replaceEntrypointArray(bundles, (_b = output.background) == null ? void 0 : _b.scripts);
  (_c = output.content_scripts) == null ? void 0 : _c.forEach((cs) => {
    replaceEntrypointArray(bundles, cs.css);
    replaceEntrypointArray(bundles, cs.js, (generated) => {
      if (!generated.endsWith("css"))
        return;
      cs.css ?? (cs.css = []);
      cs.css.push(generated);
    });
  });
  return output;
}
function findReplacement(entry, bundles) {
  const output = getOutputFile(entry);
  const generatedFiles = bundles[entry];
  if (generatedFiles == null)
    throw Error("Render Manifest: Bundle output not found for: " + entry);
  const replacementIndex = generatedFiles.indexOf(output);
  if (replacementIndex < 0)
    throw Error(`Entrypoint output for ${entry} (${output}) not found`);
  const [replacement] = generatedFiles.splice(replacementIndex, 1);
  return {
    replacement,
    generatedFiles
  };
}
function replaceEntrypoint(bundles, parent, key, onGeneratedFile) {
  const entry = parent == null ? void 0 : parent[key];
  if (entry == null)
    return;
  const { replacement, generatedFiles } = findReplacement(entry, bundles);
  parent[key] = replacement;
  if (onGeneratedFile)
    generatedFiles.forEach(onGeneratedFile);
}
function replaceEntrypointArray(bundles, parent, onGeneratedFile) {
  if (parent == null)
    return;
  for (let i = 0; i < parent.length; i++) {
    replaceEntrypoint(bundles, parent, i, onGeneratedFile);
  }
}

// src/plugins/manifest-loader-plugin.ts
function manifestLoaderPlugin(options) {
  const noInput = defineNoRollupInput();
  const logger = createLogger(options.verbose, options.disableColors);
  const ctx = createBuildContext({ logger, pluginOptions: options });
  const validateManifest = createManifestValidator({ logger });
  let mode = 0 /* BUILD */;
  let userConfig;
  let resolvedConfig;
  let extensionRunner;
  let paths;
  let isError = false;
  function configureBuildMode(config, env) {
    var _a;
    if (env.command === "serve") {
      logger.verbose("Dev mode");
      mode = 2 /* DEV */;
    } else if ((_a = config.build) == null ? void 0 : _a.watch) {
      logger.verbose("Watch mode");
      mode = 1 /* WATCH */;
    } else {
      logger.verbose("Build mode");
      mode = 0 /* BUILD */;
    }
  }
  async function loadManifest() {
    let manifestTemplate;
    if (typeof options.manifest === "function") {
      logger.verbose("Loading manifest from function");
      manifestTemplate = await options.manifest();
    } else {
      const manifestPath = path5.resolve(paths.rootDir, options.manifest);
      logger.verbose(
        `Loading manifest from file @ ${manifestPath} (root: ${paths.rootDir})`
      );
      manifestTemplate = await fs2.readJson(manifestPath);
    }
    logger.verbose(
      "Manifest template: " + inspect5(manifestTemplate, void 0, 5)
    );
    const resolvedManifest = resolveBrowserTagsInObject(
      options.browser ?? "chrome",
      manifestTemplate
    );
    logger.verbose("Manifest with entrypoints: " + inspect5(resolvedManifest));
    return resolvedManifest;
  }
  async function openBrowser() {
    logger.log("\nOpening browser...");
    extensionRunner = createWebExtRunner({
      pluginOptions: options,
      paths,
      logger
    });
    await extensionRunner.openBrowser();
    logger.log("Done!");
  }
  return {
    name: MANIFEST_LOADER_PLUGIN_NAME,
    async config(config, env) {
      if (options.browser != null) {
        logger.verbose(`Building for browser: ${options.browser}`);
      }
      configureBuildMode(config, env);
      userConfig = config;
      return vite3.mergeConfig(
        {
          build: {
            emptyOutDir: false
          }
        },
        noInput.config
      );
    },
    configResolved(config) {
      resolvedConfig = config;
      paths = {
        rootDir: getRootDir(config),
        outDir: getOutDir(config),
        publicDir: getPublicDir(config)
      };
    },
    async buildStart() {
      if (resolvedConfig.build.emptyOutDir) {
        logger.verbose("Removing build.outDir...");
        await fs2.rm(getOutDir(resolvedConfig), {
          recursive: true,
          force: true
        });
      }
      options.watchFilePaths.forEach((file) => this.addWatchFile(file));
      if (typeof options.manifest === "string") {
        this.addWatchFile(path5.resolve(paths.rootDir, options.manifest));
      }
      const manifestWithInputs = await loadManifest();
      await ctx.rebuild({
        paths,
        userConfig,
        resolvedConfig,
        manifest: manifestWithInputs,
        mode,
        onSuccess: async () => {
          if (extensionRunner)
            await extensionRunner.reload();
        }
      });
      const finalManifest = renderManifest(
        manifestWithInputs,
        ctx.getBundles()
      );
      if (mode === 2 /* DEV */) {
        applyDevServerCsp(finalManifest);
      }
      if (!options.skipManifestValidation) {
        await validateManifest(finalManifest);
      }
      if (mode !== 2 /* DEV */) {
        this.emitFile({
          type: "asset",
          source: JSON.stringify(finalManifest),
          fileName: "manifest.json",
          name: "manifest.json"
        });
      } else {
        logger.log(
          "\nWriting \x1B[95mmanifest.json\x1B[0m before starting dev server..."
        );
        await fs2.writeFile(
          path5.resolve(paths.outDir, "manifest.json"),
          JSON.stringify(finalManifest),
          "utf8"
        );
      }
      await copyPublicDirToOutDir({ mode, paths });
      if (mode === 2 /* DEV */) {
        await openBrowser();
      }
    },
    resolveId(id) {
      return noInput.resolveId(id);
    },
    load(id) {
      return noInput.load(id);
    },
    buildEnd(err) {
      isError = err != null;
    },
    async closeBundle() {
      if (isError || mode === 0 /* BUILD */ || options.disableAutoLaunch) {
        return;
      }
      await openBrowser();
    },
    generateBundle(_, bundle) {
      noInput.cleanupBundle(bundle);
    },
    async watchChange(id) {
      const relativePath = path5.relative(paths.rootDir, id);
      logger.log(
        `
${colorizeFilename(relativePath)} changed, restarting browser`
      );
      await (extensionRunner == null ? void 0 : extensionRunner.exit());
    }
  };
}
async function copyPublicDirToOutDir({
  mode,
  paths
}) {
  if (mode === 0 /* BUILD */ || !paths.publicDir || !await fs2.pathExists(paths.publicDir)) {
    return;
  }
  await fs2.copy(paths.publicDir, paths.outDir);
}
async function applyDevServerCsp(manifest) {
  var _a;
  manifest.permissions ?? (manifest.permissions = []);
  manifest.permissions.push("http://localhost/*");
  const csp = new ContentSecurityPolicy(
    manifest.manifest_version === 3 ? ((_a = manifest.content_security_policy) == null ? void 0 : _a.extension_pages) ?? "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';" : manifest.content_security_policy ?? "script-src 'self'; object-src 'self';"
  );
  csp.add("script-src", "http://localhost:*", "http://127.0.0.1:*");
  if (manifest.manifest_version === 3) {
    manifest.content_security_policy ?? (manifest.content_security_policy = {});
    manifest.content_security_policy.extension_pages = csp.toString();
  } else {
    manifest.content_security_policy = csp.toString();
  }
}

// src/index.ts
import fs3 from "fs-extra";
function webExtension(options = {}) {
  const internalOptions = {
    additionalInputs: options.additionalInputs ?? [],
    disableAutoLaunch: options.disableAutoLaunch ?? false,
    manifest: options.manifest ?? "manifest.json",
    printSummary: options.printSummary ?? true,
    skipManifestValidation: options.skipManifestValidation ?? false,
    watchFilePaths: options.watchFilePaths ?? [],
    browser: options.browser,
    htmlViteConfig: options.htmlViteConfig,
    scriptViteConfig: options.scriptViteConfig,
    webExtConfig: options.webExtConfig,
    verbose: process.argv.includes("-d") || process.argv.includes("--debug"),
    disableColors: process.env.CI === "true" || process.env.DISABLE_COLORS === "true"
  };
  return manifestLoaderPlugin(internalOptions);
}
function readJsonFile(file) {
  return fs3.readJsonSync(file);
}
export {
  webExtension as default,
  readJsonFile
};
//# sourceMappingURL=index.js.map