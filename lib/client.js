/**
 * 本文件由 `tools/build.ts` 从 `src/client/index.ts` 生成 —— **不要直接编辑**。
 *
 * 契约（见 @deepseek-ai/dsh-client-modules）：
 *   1. 这是一个普通 classic script，不是 ESM；执行时只做一件事：
 *      向 window.__ModuleLoader__ 注册一个 factory。
 *   2. factory 在首次被 materialize 时执行，返回的 exports 就是模块导出。
 *   3. id 必须等于本包 package.json 的 name（这里就是 "dsh-effort-picker"）。
 *   4. factory 里的 require 只能取平台种子模块：react / react-dom / cordis /
 *      dsh-client-store / ui-slots / ui-primitives / ui-dockkit。
 *
 * 设计说明、踩坑记录都在 src/client/ 与 AGENTS.md 里。
 */
window.__ModuleLoader__.load({
	id: "dsh-effort-picker",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;

"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.ts
var index_exports = {};
__export(index_exports, {
  SHAPE_CSS: () => SHAPE_CSS,
  apply: () => apply,
  estimatePanelPosition: () => estimatePanelPosition
});
module.exports = __toCommonJS(index_exports);

// node_modules/.pnpm/@floating-ui+utils@0.2.12/node_modules/@floating-ui/utils/dist/floating-ui.utils.mjs
var min = Math.min;
var max = Math.max;
var round = Math.round;
var floor = Math.floor;
var createCoords = (v) => ({
  x: v,
  y: v
});
var oppositeSideMap = {
  left: "right",
  right: "left",
  bottom: "top",
  top: "bottom"
};
function clamp(start, value, end) {
  return max(start, min(value, end));
}
function evaluate(value, param) {
  return typeof value === "function" ? value(param) : value;
}
function getSide(placement) {
  return placement.split("-")[0];
}
function getAlignment(placement) {
  return placement.split("-")[1];
}
function getOppositeAxis(axis) {
  return axis === "x" ? "y" : "x";
}
function getAxisLength(axis) {
  return axis === "y" ? "height" : "width";
}
function getSideAxis(placement) {
  const firstChar = placement[0];
  return firstChar === "t" || firstChar === "b" ? "y" : "x";
}
function getAlignmentAxis(placement) {
  return getOppositeAxis(getSideAxis(placement));
}
function getAlignmentSides(placement, rects, rtl) {
  if (rtl === void 0) {
    rtl = false;
  }
  const alignment = getAlignment(placement);
  const alignmentAxis = getAlignmentAxis(placement);
  const length = getAxisLength(alignmentAxis);
  let mainAlignmentSide = alignmentAxis === "x" ? alignment === (rtl ? "end" : "start") ? "right" : "left" : alignment === "start" ? "bottom" : "top";
  if (rects.reference[length] > rects.floating[length]) {
    mainAlignmentSide = getOppositePlacement(mainAlignmentSide);
  }
  return [mainAlignmentSide, getOppositePlacement(mainAlignmentSide)];
}
function getExpandedPlacements(placement) {
  const oppositePlacement = getOppositePlacement(placement);
  return [getOppositeAlignmentPlacement(placement), oppositePlacement, getOppositeAlignmentPlacement(oppositePlacement)];
}
function getOppositeAlignmentPlacement(placement) {
  return placement.includes("start") ? placement.replace("start", "end") : placement.replace("end", "start");
}
var lrPlacement = ["left", "right"];
var rlPlacement = ["right", "left"];
var tbPlacement = ["top", "bottom"];
var btPlacement = ["bottom", "top"];
function getSideList(side, isStart, rtl) {
  switch (side) {
    case "top":
    case "bottom":
      if (rtl) return isStart ? rlPlacement : lrPlacement;
      return isStart ? lrPlacement : rlPlacement;
    case "left":
    case "right":
      return isStart ? tbPlacement : btPlacement;
    default:
      return [];
  }
}
function getOppositeAxisPlacements(placement, flipAlignment, direction, rtl) {
  const alignment = getAlignment(placement);
  let list = getSideList(getSide(placement), direction === "start", rtl);
  if (alignment) {
    list = list.map((side) => side + "-" + alignment);
    if (flipAlignment) {
      list = list.concat(list.map(getOppositeAlignmentPlacement));
    }
  }
  return list;
}
function getOppositePlacement(placement) {
  const side = getSide(placement);
  return oppositeSideMap[side] + placement.slice(side.length);
}
function expandPaddingObject(padding) {
  var _padding$top, _padding$right, _padding$bottom, _padding$left;
  return {
    top: (_padding$top = padding.top) != null ? _padding$top : 0,
    right: (_padding$right = padding.right) != null ? _padding$right : 0,
    bottom: (_padding$bottom = padding.bottom) != null ? _padding$bottom : 0,
    left: (_padding$left = padding.left) != null ? _padding$left : 0
  };
}
function getPaddingObject(padding) {
  return typeof padding !== "number" ? expandPaddingObject(padding) : {
    top: padding,
    right: padding,
    bottom: padding,
    left: padding
  };
}
function rectToClientRect(rect) {
  const {
    x,
    y,
    width,
    height
  } = rect;
  return {
    width,
    height,
    top: y,
    left: x,
    right: x + width,
    bottom: y + height,
    x,
    y
  };
}

// node_modules/.pnpm/@floating-ui+core@1.8.0/node_modules/@floating-ui/core/dist/floating-ui.core.mjs
function computeCoordsFromPlacement(_ref, placement, rtl) {
  let {
    reference,
    floating
  } = _ref;
  const sideAxis = getSideAxis(placement);
  const alignmentAxis = getAlignmentAxis(placement);
  const alignLength = getAxisLength(alignmentAxis);
  const side = getSide(placement);
  const isVertical = sideAxis === "y";
  const commonX = reference.x + reference.width / 2 - floating.width / 2;
  const commonY = reference.y + reference.height / 2 - floating.height / 2;
  const commonAlign = reference[alignLength] / 2 - floating[alignLength] / 2;
  let coords;
  switch (side) {
    case "top":
      coords = {
        x: commonX,
        y: reference.y - floating.height
      };
      break;
    case "bottom":
      coords = {
        x: commonX,
        y: reference.y + reference.height
      };
      break;
    case "right":
      coords = {
        x: reference.x + reference.width,
        y: commonY
      };
      break;
    case "left":
      coords = {
        x: reference.x - floating.width,
        y: commonY
      };
      break;
    default:
      coords = {
        x: reference.x,
        y: reference.y
      };
  }
  const alignment = getAlignment(placement);
  if (alignment) {
    coords[alignmentAxis] += commonAlign * (alignment === "end" ? 1 : -1) * (rtl && isVertical ? -1 : 1);
  }
  return coords;
}
async function detectOverflow(state, options) {
  var _await$platform$isEle;
  if (options === void 0) {
    options = {};
  }
  const {
    x,
    y,
    platform: platform2,
    rects,
    elements,
    strategy
  } = state;
  const {
    boundary = "clippingAncestors",
    rootBoundary = "viewport",
    elementContext = "floating",
    altBoundary = false,
    padding = 0
  } = evaluate(options, state);
  const paddingObject = getPaddingObject(padding);
  const altContext = elementContext === "floating" ? "reference" : "floating";
  const element = elements[altBoundary ? altContext : elementContext];
  const clippingClientRect = rectToClientRect(await platform2.getClippingRect({
    element: ((_await$platform$isEle = await (platform2.isElement == null ? void 0 : platform2.isElement(element))) != null ? _await$platform$isEle : true) ? element : element.contextElement || await (platform2.getDocumentElement == null ? void 0 : platform2.getDocumentElement(elements.floating)),
    boundary,
    rootBoundary,
    strategy
  }));
  const rect = elementContext === "floating" ? {
    x,
    y,
    width: rects.floating.width,
    height: rects.floating.height
  } : rects.reference;
  const offsetParent = await (platform2.getOffsetParent == null ? void 0 : platform2.getOffsetParent(elements.floating));
  const offsetScale = await (platform2.isElement == null ? void 0 : platform2.isElement(offsetParent)) && await (platform2.getScale == null ? void 0 : platform2.getScale(offsetParent)) || {
    x: 1,
    y: 1
  };
  const elementClientRect = rectToClientRect(platform2.convertOffsetParentRelativeRectToViewportRelativeRect ? await platform2.convertOffsetParentRelativeRectToViewportRelativeRect({
    elements,
    rect,
    offsetParent,
    strategy
  }) : rect);
  return {
    top: (clippingClientRect.top - elementClientRect.top + paddingObject.top) / offsetScale.y,
    bottom: (elementClientRect.bottom - clippingClientRect.bottom + paddingObject.bottom) / offsetScale.y,
    left: (clippingClientRect.left - elementClientRect.left + paddingObject.left) / offsetScale.x,
    right: (elementClientRect.right - clippingClientRect.right + paddingObject.right) / offsetScale.x
  };
}
var MAX_RESET_COUNT = 50;
var computePosition = async (reference, floating, config) => {
  const {
    placement = "bottom",
    strategy = "absolute",
    middleware = [],
    platform: platform2
  } = config;
  const platformWithDetectOverflow = platform2.detectOverflow ? platform2 : {
    ...platform2,
    detectOverflow
  };
  const rtl = await (platform2.isRTL == null ? void 0 : platform2.isRTL(floating));
  let rects = await platform2.getElementRects({
    reference,
    floating,
    strategy
  });
  let {
    x,
    y
  } = computeCoordsFromPlacement(rects, placement, rtl);
  let statefulPlacement = placement;
  let resetCount = 0;
  const middlewareData = {};
  for (let i = 0; i < middleware.length; i++) {
    const currentMiddleware = middleware[i];
    if (!currentMiddleware) {
      continue;
    }
    const {
      name,
      fn
    } = currentMiddleware;
    const {
      x: nextX,
      y: nextY,
      data,
      reset
    } = await fn({
      x,
      y,
      initialPlacement: placement,
      placement: statefulPlacement,
      strategy,
      middlewareData,
      rects,
      platform: platformWithDetectOverflow,
      elements: {
        reference,
        floating
      }
    });
    x = nextX != null ? nextX : x;
    y = nextY != null ? nextY : y;
    middlewareData[name] = {
      ...middlewareData[name],
      ...data
    };
    if (reset && resetCount < MAX_RESET_COUNT) {
      resetCount++;
      if (typeof reset === "object") {
        if (reset.placement) {
          statefulPlacement = reset.placement;
        }
        if (reset.rects) {
          rects = reset.rects === true ? await platform2.getElementRects({
            reference,
            floating,
            strategy
          }) : reset.rects;
        }
        ({
          x,
          y
        } = computeCoordsFromPlacement(rects, statefulPlacement, rtl));
      }
      i = -1;
    }
  }
  return {
    x,
    y,
    placement: statefulPlacement,
    strategy,
    middlewareData
  };
};
var flip = function(options) {
  if (options === void 0) {
    options = {};
  }
  return {
    name: "flip",
    options,
    async fn(state) {
      var _middlewareData$arrow, _middlewareData$flip;
      const {
        placement,
        middlewareData,
        rects,
        initialPlacement,
        platform: platform2,
        elements
      } = state;
      const {
        mainAxis: checkMainAxis = true,
        crossAxis: checkCrossAxis = true,
        fallbackPlacements: specifiedFallbackPlacements,
        fallbackStrategy = "bestFit",
        fallbackAxisSideDirection = "none",
        flipAlignment = true,
        ...detectOverflowOptions
      } = evaluate(options, state);
      if ((_middlewareData$arrow = middlewareData.arrow) != null && _middlewareData$arrow.alignmentOffset) {
        return {};
      }
      const side = getSide(placement);
      const initialSideAxis = getSideAxis(initialPlacement);
      const isBasePlacement = getSide(initialPlacement) === initialPlacement;
      const rtl = await (platform2.isRTL == null ? void 0 : platform2.isRTL(elements.floating));
      const fallbackPlacements = specifiedFallbackPlacements || (isBasePlacement || !flipAlignment ? [getOppositePlacement(initialPlacement)] : getExpandedPlacements(initialPlacement));
      const hasFallbackAxisSideDirection = fallbackAxisSideDirection !== "none";
      if (!specifiedFallbackPlacements && hasFallbackAxisSideDirection) {
        fallbackPlacements.push(...getOppositeAxisPlacements(initialPlacement, flipAlignment, fallbackAxisSideDirection, rtl));
      }
      const placements2 = [initialPlacement, ...fallbackPlacements];
      const overflow = await platform2.detectOverflow(state, detectOverflowOptions);
      const overflows = [];
      let overflowsData = ((_middlewareData$flip = middlewareData.flip) == null ? void 0 : _middlewareData$flip.overflows) || [];
      if (checkMainAxis) {
        overflows.push(overflow[side]);
      }
      if (checkCrossAxis) {
        const sides2 = getAlignmentSides(placement, rects, rtl);
        overflows.push(overflow[sides2[0]], overflow[sides2[1]]);
      }
      overflowsData = [...overflowsData, {
        placement,
        overflows
      }];
      if (!overflows.every((side2) => side2 <= 0)) {
        var _middlewareData$flip2, _overflowsData$filter;
        const nextIndex = (((_middlewareData$flip2 = middlewareData.flip) == null ? void 0 : _middlewareData$flip2.index) || 0) + 1;
        const nextPlacement = placements2[nextIndex];
        if (nextPlacement) {
          const ignoreCrossAxisOverflow = checkCrossAxis === "alignment" ? initialSideAxis !== getSideAxis(nextPlacement) : false;
          if (!ignoreCrossAxisOverflow || // We leave the current main axis only if every placement on that axis
          // overflows the main axis.
          overflowsData.every((d) => getSideAxis(d.placement) === initialSideAxis ? d.overflows[0] > 0 : true)) {
            return {
              data: {
                index: nextIndex,
                overflows: overflowsData
              },
              reset: {
                placement: nextPlacement
              }
            };
          }
        }
        let resetPlacement = (_overflowsData$filter = overflowsData.filter((d) => d.overflows[0] <= 0).sort((a, b) => a.overflows[1] - b.overflows[1])[0]) == null ? void 0 : _overflowsData$filter.placement;
        if (!resetPlacement) {
          switch (fallbackStrategy) {
            case "bestFit": {
              var _overflowsData$filter2;
              const placement2 = (_overflowsData$filter2 = overflowsData.filter((d) => {
                if (hasFallbackAxisSideDirection) {
                  const currentSideAxis = getSideAxis(d.placement);
                  return currentSideAxis === initialSideAxis || // Create a bias to the `y` side axis due to horizontal
                  // reading directions favoring greater width.
                  currentSideAxis === "y";
                }
                return true;
              }).map((d) => [d.placement, d.overflows.filter((overflow2) => overflow2 > 0).reduce((acc, overflow2) => acc + overflow2, 0)]).sort((a, b) => a[1] - b[1])[0]) == null ? void 0 : _overflowsData$filter2[0];
              if (placement2) {
                resetPlacement = placement2;
              }
              break;
            }
            case "initialPlacement":
              resetPlacement = initialPlacement;
              break;
          }
        }
        if (placement !== resetPlacement) {
          return {
            reset: {
              placement: resetPlacement
            }
          };
        }
      }
      return {};
    }
  };
};
var originSides = /* @__PURE__ */ new Set(["left", "top"]);
async function convertValueToCoords(state, options) {
  const {
    placement,
    platform: platform2,
    elements
  } = state;
  const rtl = await (platform2.isRTL == null ? void 0 : platform2.isRTL(elements.floating));
  const side = getSide(placement);
  const alignment = getAlignment(placement);
  const isVertical = getSideAxis(placement) === "y";
  const mainAxisMulti = originSides.has(side) ? -1 : 1;
  const crossAxisMulti = rtl && isVertical ? -1 : 1;
  const rawValue = evaluate(options, state);
  let {
    mainAxis,
    crossAxis,
    alignmentAxis
  } = typeof rawValue === "number" ? {
    mainAxis: rawValue,
    crossAxis: 0,
    alignmentAxis: null
  } : {
    mainAxis: rawValue.mainAxis || 0,
    crossAxis: rawValue.crossAxis || 0,
    alignmentAxis: rawValue.alignmentAxis
  };
  if (alignment && typeof alignmentAxis === "number") {
    crossAxis = alignment === "end" ? alignmentAxis * -1 : alignmentAxis;
  }
  return isVertical ? {
    x: crossAxis * crossAxisMulti,
    y: mainAxis * mainAxisMulti
  } : {
    x: mainAxis * mainAxisMulti,
    y: crossAxis * crossAxisMulti
  };
}
var offset = function(options) {
  if (options === void 0) {
    options = 0;
  }
  return {
    name: "offset",
    options,
    async fn(state) {
      var _middlewareData$offse, _middlewareData$arrow;
      const {
        x,
        y,
        placement,
        middlewareData
      } = state;
      const diffCoords = await convertValueToCoords(state, options);
      if (placement === ((_middlewareData$offse = middlewareData.offset) == null ? void 0 : _middlewareData$offse.placement) && (_middlewareData$arrow = middlewareData.arrow) != null && _middlewareData$arrow.alignmentOffset) {
        return {};
      }
      return {
        x: x + diffCoords.x,
        y: y + diffCoords.y,
        data: {
          ...diffCoords,
          placement
        }
      };
    }
  };
};
var shift = function(options) {
  if (options === void 0) {
    options = {};
  }
  return {
    name: "shift",
    options,
    async fn(state) {
      const {
        x,
        y,
        placement,
        platform: platform2
      } = state;
      const {
        mainAxis: checkMainAxis = true,
        crossAxis: checkCrossAxis = false,
        limiter = {
          fn: (_ref) => {
            let {
              x: x2,
              y: y2
            } = _ref;
            return {
              x: x2,
              y: y2
            };
          }
        },
        ...detectOverflowOptions
      } = evaluate(options, state);
      const coords = {
        x,
        y
      };
      const overflow = await platform2.detectOverflow(state, detectOverflowOptions);
      const crossAxis = getSideAxis(placement);
      const mainAxis = getOppositeAxis(crossAxis);
      let mainAxisCoord = coords[mainAxis];
      let crossAxisCoord = coords[crossAxis];
      const clampCoord = (axis, coord) => clamp(coord + overflow[axis === "y" ? "top" : "left"], coord, coord - overflow[axis === "y" ? "bottom" : "right"]);
      if (checkMainAxis) {
        mainAxisCoord = clampCoord(mainAxis, mainAxisCoord);
      }
      if (checkCrossAxis) {
        crossAxisCoord = clampCoord(crossAxis, crossAxisCoord);
      }
      const limitedCoords = limiter.fn({
        ...state,
        [mainAxis]: mainAxisCoord,
        [crossAxis]: crossAxisCoord
      });
      return {
        ...limitedCoords,
        data: {
          x: limitedCoords.x - x,
          y: limitedCoords.y - y,
          enabled: {
            [mainAxis]: checkMainAxis,
            [crossAxis]: checkCrossAxis
          }
        }
      };
    }
  };
};

// node_modules/.pnpm/@floating-ui+utils@0.2.12/node_modules/@floating-ui/utils/dist/floating-ui.utils.dom.mjs
function hasWindow() {
  return typeof window !== "undefined";
}
function getNodeName(node) {
  if (isNode(node)) {
    return (node.nodeName || "").toLowerCase();
  }
  return "#document";
}
function getWindow(node) {
  var _node$ownerDocument;
  return (node == null || (_node$ownerDocument = node.ownerDocument) == null ? void 0 : _node$ownerDocument.defaultView) || window;
}
function getDocumentElement(node) {
  var _ref;
  return (_ref = (isNode(node) ? node.ownerDocument : node.document) || window.document) == null ? void 0 : _ref.documentElement;
}
function isNode(value) {
  if (!hasWindow()) {
    return false;
  }
  return value instanceof Node || value instanceof getWindow(value).Node;
}
function isElement(value) {
  if (!hasWindow()) {
    return false;
  }
  return value instanceof Element || value instanceof getWindow(value).Element;
}
function isHTMLElement(value) {
  if (!hasWindow()) {
    return false;
  }
  return value instanceof HTMLElement || value instanceof getWindow(value).HTMLElement;
}
function isShadowRoot(value) {
  if (!hasWindow() || typeof ShadowRoot === "undefined") {
    return false;
  }
  return value instanceof ShadowRoot || value instanceof getWindow(value).ShadowRoot;
}
function isOverflowElement(element) {
  const {
    overflow,
    overflowX,
    overflowY,
    display
  } = getComputedStyle2(element);
  return /auto|scroll|overlay|hidden|clip/.test(overflow + overflowY + overflowX) && display !== "inline" && display !== "contents";
}
function isTableElement(element) {
  return /^(table|td|th)$/.test(getNodeName(element));
}
function isTopLayer(element) {
  try {
    if (element.matches(":popover-open")) {
      return true;
    }
  } catch (_e) {
  }
  try {
    return element.matches(":modal");
  } catch (_e) {
    return false;
  }
}
var willChangeRe = /transform|translate|scale|rotate|perspective|filter/;
var containRe = /paint|layout|strict|content/;
var isNotNone = (value) => !!value && value !== "none";
var isWebKitValue;
function isContainingBlock(elementOrCss) {
  const css = isElement(elementOrCss) ? getComputedStyle2(elementOrCss) : elementOrCss;
  return isNotNone(css.transform) || isNotNone(css.translate) || isNotNone(css.scale) || isNotNone(css.rotate) || isNotNone(css.perspective) || !isWebKit() && (isNotNone(css.backdropFilter) || isNotNone(css.filter)) || willChangeRe.test(css.willChange || "") || containRe.test(css.contain || "");
}
function getContainingBlock(element) {
  let currentNode = getParentNode(element);
  while (isHTMLElement(currentNode) && !isLastTraversableNode(currentNode)) {
    if (isContainingBlock(currentNode)) {
      return currentNode;
    } else if (isTopLayer(currentNode)) {
      return null;
    }
    currentNode = getParentNode(currentNode);
  }
  return null;
}
function isWebKit() {
  if (isWebKitValue == null) {
    isWebKitValue = typeof CSS !== "undefined" && CSS.supports && CSS.supports("-webkit-backdrop-filter", "none");
  }
  return isWebKitValue;
}
function isLastTraversableNode(node) {
  return /^(html|body|#document)$/.test(getNodeName(node));
}
function getComputedStyle2(element) {
  return getWindow(element).getComputedStyle(element);
}
function getNodeScroll(element) {
  if (isElement(element)) {
    return {
      scrollLeft: element.scrollLeft,
      scrollTop: element.scrollTop
    };
  }
  return {
    scrollLeft: element.scrollX,
    scrollTop: element.scrollY
  };
}
function getParentNode(node) {
  if (getNodeName(node) === "html") {
    return node;
  }
  const result = (
    // Step into the shadow DOM of the parent of a slotted node.
    node.assignedSlot || // DOM Element detected.
    node.parentNode || // ShadowRoot detected.
    isShadowRoot(node) && node.host || // Fallback.
    getDocumentElement(node)
  );
  return isShadowRoot(result) ? result.host : result;
}
function getNearestOverflowAncestor(node) {
  const parentNode = getParentNode(node);
  if (isLastTraversableNode(parentNode)) {
    return (node.ownerDocument || node).body;
  }
  if (isHTMLElement(parentNode) && isOverflowElement(parentNode)) {
    return parentNode;
  }
  return getNearestOverflowAncestor(parentNode);
}
function getOverflowAncestors(node, list, traverseIframes) {
  var _node$ownerDocument2;
  if (list === void 0) {
    list = [];
  }
  if (traverseIframes === void 0) {
    traverseIframes = true;
  }
  const scrollableAncestor = getNearestOverflowAncestor(node);
  const isBody = scrollableAncestor === ((_node$ownerDocument2 = node.ownerDocument) == null ? void 0 : _node$ownerDocument2.body);
  const win = getWindow(scrollableAncestor);
  if (isBody) {
    const frameElement = getFrameElement(win);
    return list.concat(win, win.visualViewport || [], isOverflowElement(scrollableAncestor) ? scrollableAncestor : [], frameElement && traverseIframes ? getOverflowAncestors(frameElement) : []);
  } else {
    return list.concat(scrollableAncestor, getOverflowAncestors(scrollableAncestor, [], traverseIframes));
  }
}
function getFrameElement(win) {
  return win.parent && Object.getPrototypeOf(win.parent) ? win.frameElement : null;
}

// node_modules/.pnpm/@floating-ui+dom@1.8.0/node_modules/@floating-ui/dom/dist/floating-ui.dom.mjs
function getCssDimensions(element) {
  const css = getComputedStyle2(element);
  let width = parseFloat(css.width) || 0;
  let height = parseFloat(css.height) || 0;
  const hasOffset = isHTMLElement(element);
  const offsetWidth = hasOffset ? element.offsetWidth : width;
  const offsetHeight = hasOffset ? element.offsetHeight : height;
  const shouldFallback = round(width) !== offsetWidth || round(height) !== offsetHeight;
  if (shouldFallback) {
    width = offsetWidth;
    height = offsetHeight;
  }
  return {
    width,
    height,
    $: shouldFallback
  };
}
function unwrapElement(element) {
  return !isElement(element) ? element.contextElement : element;
}
function getScale(element) {
  const domElement = unwrapElement(element);
  if (!isHTMLElement(domElement)) {
    return createCoords(1);
  }
  const rect = domElement.getBoundingClientRect();
  const {
    width,
    height,
    $
  } = getCssDimensions(domElement);
  let x = ($ ? round(rect.width) : rect.width) / width;
  let y = ($ ? round(rect.height) : rect.height) / height;
  if (!x || !Number.isFinite(x)) {
    x = 1;
  }
  if (!y || !Number.isFinite(y)) {
    y = 1;
  }
  return {
    x,
    y
  };
}
var noOffsets = /* @__PURE__ */ createCoords(0);
function getVisualOffsets(element) {
  const win = getWindow(element);
  if (!isWebKit() || !win.visualViewport) {
    return noOffsets;
  }
  return {
    x: win.visualViewport.offsetLeft,
    y: win.visualViewport.offsetTop
  };
}
function shouldAddVisualOffsets(element, isFixed, floatingOffsetParent) {
  if (isFixed === void 0) {
    isFixed = false;
  }
  return !!floatingOffsetParent && isFixed && floatingOffsetParent === getWindow(element);
}
function getBoundingClientRect(element, includeScale, isFixedStrategy, offsetParent) {
  if (includeScale === void 0) {
    includeScale = false;
  }
  if (isFixedStrategy === void 0) {
    isFixedStrategy = false;
  }
  const clientRect = element.getBoundingClientRect();
  const domElement = unwrapElement(element);
  let scale = createCoords(1);
  if (includeScale) {
    if (offsetParent) {
      if (isElement(offsetParent)) {
        scale = getScale(offsetParent);
      }
    } else {
      scale = getScale(element);
    }
  }
  const visualOffsets = shouldAddVisualOffsets(domElement, isFixedStrategy, offsetParent) ? getVisualOffsets(domElement) : createCoords(0);
  let x = (clientRect.left + visualOffsets.x) / scale.x;
  let y = (clientRect.top + visualOffsets.y) / scale.y;
  let width = clientRect.width / scale.x;
  let height = clientRect.height / scale.y;
  if (domElement && offsetParent) {
    const win = getWindow(domElement);
    const offsetWin = isElement(offsetParent) ? getWindow(offsetParent) : offsetParent;
    let currentWin = win;
    let currentIFrame = getFrameElement(currentWin);
    while (currentIFrame && offsetWin !== currentWin) {
      const iframeScale = getScale(currentIFrame);
      const iframeRect = currentIFrame.getBoundingClientRect();
      const css = getComputedStyle2(currentIFrame);
      const left = iframeRect.left + (currentIFrame.clientLeft + parseFloat(css.paddingLeft)) * iframeScale.x;
      const top = iframeRect.top + (currentIFrame.clientTop + parseFloat(css.paddingTop)) * iframeScale.y;
      x *= iframeScale.x;
      y *= iframeScale.y;
      width *= iframeScale.x;
      height *= iframeScale.y;
      x += left;
      y += top;
      currentWin = getWindow(currentIFrame);
      currentIFrame = getFrameElement(currentWin);
    }
  }
  return rectToClientRect({
    width,
    height,
    x,
    y
  });
}
function getWindowScrollBarX(element, rect) {
  const leftScroll = getNodeScroll(element).scrollLeft;
  if (!rect) {
    return getBoundingClientRect(getDocumentElement(element)).left + leftScroll;
  }
  return rect.left + leftScroll;
}
function getHTMLOffset(documentElement, scroll) {
  const htmlRect = documentElement.getBoundingClientRect();
  const x = htmlRect.left + scroll.scrollLeft - getWindowScrollBarX(documentElement, htmlRect);
  const y = htmlRect.top + scroll.scrollTop;
  return {
    x,
    y
  };
}
function convertOffsetParentRelativeRectToViewportRelativeRect(_ref) {
  let {
    elements,
    rect,
    offsetParent,
    strategy
  } = _ref;
  const isFixed = strategy === "fixed";
  const documentElement = getDocumentElement(offsetParent);
  const topLayer = elements ? isTopLayer(elements.floating) : false;
  if (offsetParent === documentElement || topLayer && isFixed) {
    return rect;
  }
  let scroll = {
    scrollLeft: 0,
    scrollTop: 0
  };
  let scale = createCoords(1);
  const offsets = createCoords(0);
  const isOffsetParentAnElement = isHTMLElement(offsetParent);
  if (isOffsetParentAnElement || !isFixed) {
    if (getNodeName(offsetParent) !== "body" || isOverflowElement(documentElement)) {
      scroll = getNodeScroll(offsetParent);
    }
    if (isOffsetParentAnElement) {
      const offsetRect = getBoundingClientRect(offsetParent);
      scale = getScale(offsetParent);
      offsets.x = offsetRect.x + offsetParent.clientLeft;
      offsets.y = offsetRect.y + offsetParent.clientTop;
    }
  }
  const htmlOffset = documentElement && !isOffsetParentAnElement && !isFixed ? getHTMLOffset(documentElement, scroll) : createCoords(0);
  return {
    width: rect.width * scale.x,
    height: rect.height * scale.y,
    x: rect.x * scale.x - scroll.scrollLeft * scale.x + offsets.x + htmlOffset.x,
    y: rect.y * scale.y - scroll.scrollTop * scale.y + offsets.y + htmlOffset.y
  };
}
function getClientRects(element) {
  return element.getClientRects ? Array.from(element.getClientRects()) : [];
}
function getDocumentRect(html) {
  const scroll = getNodeScroll(html);
  const body = html.ownerDocument.body;
  const width = max(html.scrollWidth, html.clientWidth, body.scrollWidth, body.clientWidth);
  const height = max(html.scrollHeight, html.clientHeight, body.scrollHeight, body.clientHeight);
  let x = -scroll.scrollLeft + getWindowScrollBarX(html);
  const y = -scroll.scrollTop;
  if (getComputedStyle2(body).direction === "rtl") {
    x += max(html.clientWidth, body.clientWidth) - width;
  }
  return {
    width,
    height,
    x,
    y
  };
}
var SCROLLBAR_MAX = 25;
function getViewportRect(element, strategy, rootBoundary) {
  if (rootBoundary === void 0) {
    rootBoundary = "viewport";
  }
  const isLayoutViewport = rootBoundary === "layoutViewport";
  const win = getWindow(element);
  const html = getDocumentElement(element);
  const visualViewport = win.visualViewport;
  let width = html.clientWidth;
  let height = html.clientHeight;
  let x = 0;
  let y = 0;
  if (visualViewport) {
    const layoutRelativeClientCoords = !isWebKit() || strategy === "fixed";
    if (isLayoutViewport) {
      if (!layoutRelativeClientCoords) {
        x = -visualViewport.offsetLeft;
        y = -visualViewport.offsetTop;
      }
    } else {
      width = visualViewport.width;
      height = visualViewport.height;
      if (layoutRelativeClientCoords) {
        x = visualViewport.offsetLeft;
        y = visualViewport.offsetTop;
      }
    }
  }
  const windowScrollbarX = getWindowScrollBarX(html);
  if (windowScrollbarX <= 0) {
    const doc = html.ownerDocument;
    const body = doc.body;
    const bodyStyles = getComputedStyle(body);
    const bodyMarginInline = doc.compatMode === "CSS1Compat" ? parseFloat(bodyStyles.marginLeft) + parseFloat(bodyStyles.marginRight) || 0 : 0;
    const reservedWidth = Math.abs(html.clientWidth - body.clientWidth - bodyMarginInline);
    const gutter = getComputedStyle(html).scrollbarGutter === "stable both-edges" ? reservedWidth / 2 : reservedWidth;
    if (gutter <= SCROLLBAR_MAX) {
      width -= gutter;
    }
  }
  return {
    width,
    height,
    x,
    y
  };
}
function getInnerBoundingClientRect(element, strategy) {
  const clientRect = getBoundingClientRect(element, true, strategy === "fixed");
  const top = clientRect.top + element.clientTop;
  const left = clientRect.left + element.clientLeft;
  const scale = getScale(element);
  const width = element.clientWidth * scale.x;
  const height = element.clientHeight * scale.y;
  const x = left * scale.x;
  const y = top * scale.y;
  return {
    width,
    height,
    x,
    y
  };
}
function getClientRectFromClippingAncestor(element, clippingAncestor, strategy) {
  let rect;
  if (clippingAncestor === "viewport" || clippingAncestor === "layoutViewport") {
    rect = getViewportRect(element, strategy, clippingAncestor);
  } else if (clippingAncestor === "document") {
    rect = getDocumentRect(getDocumentElement(element));
  } else if (isElement(clippingAncestor)) {
    rect = getInnerBoundingClientRect(clippingAncestor, strategy);
  } else {
    const visualOffsets = getVisualOffsets(element);
    rect = {
      x: clippingAncestor.x - visualOffsets.x,
      y: clippingAncestor.y - visualOffsets.y,
      width: clippingAncestor.width,
      height: clippingAncestor.height
    };
  }
  return rectToClientRect(rect);
}
function getClippingElementAncestors(element, cache) {
  const cachedResult = cache.get(element);
  if (cachedResult) {
    return cachedResult;
  }
  let result = getOverflowAncestors(element, [], false).filter((el) => isElement(el) && getNodeName(el) !== "body");
  let lastKeptComputedStyle = null;
  const elementIsFixed = getComputedStyle2(element).position === "fixed";
  let currentNode = elementIsFixed ? getParentNode(element) : element;
  while (isElement(currentNode) && !isLastTraversableNode(currentNode)) {
    const computedStyle = getComputedStyle2(currentNode);
    const currentNodeIsContaining = isContainingBlock(currentNode);
    const lastPosition = lastKeptComputedStyle ? lastKeptComputedStyle.position : elementIsFixed ? "fixed" : "";
    const shouldDropCurrentNode = !currentNodeIsContaining && (lastPosition === "fixed" || lastPosition === "absolute" && computedStyle.position === "static");
    if (shouldDropCurrentNode) {
      result = result.filter((ancestor) => ancestor !== currentNode);
    } else {
      lastKeptComputedStyle = computedStyle;
    }
    currentNode = getParentNode(currentNode);
  }
  cache.set(element, result);
  return result;
}
function getClippingRect(_ref) {
  let {
    element,
    boundary,
    rootBoundary,
    strategy
  } = _ref;
  const elementClippingAncestors = boundary === "clippingAncestors" ? isTopLayer(element) ? [] : getClippingElementAncestors(element, this._c) : [].concat(boundary);
  const clippingAncestors = [...elementClippingAncestors, rootBoundary];
  const firstRect = getClientRectFromClippingAncestor(element, clippingAncestors[0], strategy);
  let top = firstRect.top;
  let right = firstRect.right;
  let bottom = firstRect.bottom;
  let left = firstRect.left;
  for (let i = 1; i < clippingAncestors.length; i++) {
    const rect = getClientRectFromClippingAncestor(element, clippingAncestors[i], strategy);
    top = max(rect.top, top);
    right = min(rect.right, right);
    bottom = min(rect.bottom, bottom);
    left = max(rect.left, left);
  }
  return {
    width: right - left,
    height: bottom - top,
    x: left,
    y: top
  };
}
function getDimensions(element) {
  const {
    width,
    height
  } = getCssDimensions(element);
  return {
    width,
    height
  };
}
function getRectRelativeToOffsetParent(element, offsetParent, strategy) {
  const isOffsetParentAnElement = isHTMLElement(offsetParent);
  const documentElement = getDocumentElement(offsetParent);
  const isFixed = strategy === "fixed";
  const rect = getBoundingClientRect(element, true, isFixed, offsetParent);
  let scroll = {
    scrollLeft: 0,
    scrollTop: 0
  };
  const offsets = createCoords(0);
  if (isOffsetParentAnElement || !isFixed) {
    if (getNodeName(offsetParent) !== "body" || isOverflowElement(documentElement)) {
      scroll = getNodeScroll(offsetParent);
    }
    if (isOffsetParentAnElement) {
      const offsetRect = getBoundingClientRect(offsetParent, true, isFixed, offsetParent);
      offsets.x = offsetRect.x + offsetParent.clientLeft;
      offsets.y = offsetRect.y + offsetParent.clientTop;
    }
  }
  if (!isOffsetParentAnElement && documentElement) {
    offsets.x = getWindowScrollBarX(documentElement);
  }
  const htmlOffset = documentElement && !isOffsetParentAnElement && !isFixed ? getHTMLOffset(documentElement, scroll) : createCoords(0);
  const x = rect.left + scroll.scrollLeft - offsets.x - htmlOffset.x;
  const y = rect.top + scroll.scrollTop - offsets.y - htmlOffset.y;
  return {
    x,
    y,
    width: rect.width,
    height: rect.height
  };
}
function isStaticPositioned(element) {
  return getComputedStyle2(element).position === "static";
}
function getTrueOffsetParent(element, polyfill) {
  if (!isHTMLElement(element) || getComputedStyle2(element).position === "fixed") {
    return null;
  }
  if (polyfill) {
    return polyfill(element);
  }
  let rawOffsetParent = element.offsetParent;
  if (getDocumentElement(element) === rawOffsetParent) {
    rawOffsetParent = rawOffsetParent.ownerDocument.body;
  }
  return rawOffsetParent;
}
function getOffsetParent(element, polyfill) {
  const win = getWindow(element);
  if (isTopLayer(element)) {
    return win;
  }
  if (!isHTMLElement(element)) {
    let svgOffsetParent = getParentNode(element);
    while (svgOffsetParent && !isLastTraversableNode(svgOffsetParent)) {
      if (isElement(svgOffsetParent) && !isStaticPositioned(svgOffsetParent)) {
        return svgOffsetParent;
      }
      svgOffsetParent = getParentNode(svgOffsetParent);
    }
    return win;
  }
  let offsetParent = getTrueOffsetParent(element, polyfill);
  while (offsetParent && isTableElement(offsetParent) && isStaticPositioned(offsetParent)) {
    offsetParent = getTrueOffsetParent(offsetParent, polyfill);
  }
  if (offsetParent && isLastTraversableNode(offsetParent) && isStaticPositioned(offsetParent) && !isContainingBlock(offsetParent)) {
    return win;
  }
  return offsetParent || getContainingBlock(element) || win;
}
var getElementRects = async function(data) {
  const getOffsetParentFn = this.getOffsetParent || getOffsetParent;
  const getDimensionsFn = this.getDimensions;
  const floatingDimensions = await getDimensionsFn(data.floating);
  return {
    reference: getRectRelativeToOffsetParent(data.reference, await getOffsetParentFn(data.floating), data.strategy),
    floating: {
      x: 0,
      y: 0,
      width: floatingDimensions.width,
      height: floatingDimensions.height
    }
  };
};
function isRTL(element) {
  return getComputedStyle2(element).direction === "rtl";
}
var platform = {
  convertOffsetParentRelativeRectToViewportRelativeRect,
  getDocumentElement,
  getClippingRect,
  getOffsetParent,
  getElementRects,
  getClientRects,
  getDimensions,
  getScale,
  isElement,
  isRTL
};
function rectsAreEqual(a, b) {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}
function observeMove(element, onMove, ancestorResize) {
  let io = null;
  let timeoutId;
  const root = getDocumentElement(element);
  function cleanup() {
    var _io;
    clearTimeout(timeoutId);
    (_io = io) == null || _io.disconnect();
    io = null;
  }
  function refresh(skip, threshold) {
    if (skip === void 0) {
      skip = false;
    }
    if (threshold === void 0) {
      threshold = 1;
    }
    cleanup();
    const elementRectForRootMargin = element.getBoundingClientRect();
    const {
      left,
      top,
      width,
      height
    } = elementRectForRootMargin;
    if (!skip) {
      onMove();
    }
    if (!width || !height) {
      return;
    }
    const insetTop = floor(top);
    const insetRight = floor(root.clientWidth - (left + width));
    const insetBottom = floor(root.clientHeight - (top + height));
    const insetLeft = floor(left);
    const rootMargin = -insetTop + "px " + -insetRight + "px " + -insetBottom + "px " + -insetLeft + "px";
    const options = {
      rootMargin,
      threshold: max(0, min(1, threshold)) || 1
    };
    let isFirstUpdate = true;
    function handleObserve(entries) {
      const ratio = entries[0].intersectionRatio;
      if (!rectsAreEqual(elementRectForRootMargin, element.getBoundingClientRect())) {
        return refresh();
      }
      if (ratio !== threshold) {
        if (!isFirstUpdate) {
          return refresh();
        }
        if (!ratio) {
          timeoutId = setTimeout(() => {
            refresh(false, 1e-7);
          }, 1e3);
        } else {
          refresh(false, ratio);
        }
      }
      isFirstUpdate = false;
    }
    try {
      io = new IntersectionObserver(handleObserve, {
        ...options,
        // Handle <iframe>s
        root: root.ownerDocument
      });
    } catch (_e) {
      io = new IntersectionObserver(handleObserve, options);
    }
    io.observe(element);
  }
  const win = getWindow(element);
  const handleResize = () => refresh(ancestorResize);
  win.addEventListener("resize", handleResize);
  refresh(true);
  return () => {
    win.removeEventListener("resize", handleResize);
    cleanup();
  };
}
function autoUpdate(reference, floating, update, options) {
  if (options === void 0) {
    options = {};
  }
  const {
    ancestorScroll = true,
    ancestorResize = true,
    elementResize = typeof ResizeObserver === "function",
    layoutShift = typeof IntersectionObserver === "function",
    animationFrame = false
  } = options;
  const referenceEl = unwrapElement(reference);
  const ancestors = ancestorScroll || ancestorResize ? [...referenceEl ? getOverflowAncestors(referenceEl) : [], ...floating ? getOverflowAncestors(floating) : []] : [];
  ancestors.forEach((ancestor) => {
    ancestorScroll && ancestor.addEventListener("scroll", update);
    ancestorResize && ancestor.addEventListener("resize", update);
  });
  const cleanupIo = referenceEl && layoutShift ? observeMove(referenceEl, update, ancestorResize) : null;
  let reobserveFrame = -1;
  let resizeObserver = null;
  if (elementResize) {
    resizeObserver = new ResizeObserver((_ref) => {
      let [firstEntry] = _ref;
      if (firstEntry && firstEntry.target === referenceEl && resizeObserver && floating) {
        resizeObserver.unobserve(floating);
        cancelAnimationFrame(reobserveFrame);
        reobserveFrame = requestAnimationFrame(() => {
          var _resizeObserver;
          (_resizeObserver = resizeObserver) == null || _resizeObserver.observe(floating);
        });
      }
      update();
    });
    if (referenceEl && !animationFrame) {
      resizeObserver.observe(referenceEl);
    }
    if (floating) {
      resizeObserver.observe(floating);
    }
  }
  let frameId;
  let prevRefRect = animationFrame ? getBoundingClientRect(reference) : null;
  if (animationFrame) {
    frameLoop();
  }
  function frameLoop() {
    const nextRefRect = getBoundingClientRect(reference);
    if (prevRefRect && !rectsAreEqual(prevRefRect, nextRefRect)) {
      update();
    }
    prevRefRect = nextRefRect;
    frameId = requestAnimationFrame(frameLoop);
  }
  update();
  return () => {
    var _resizeObserver2;
    ancestors.forEach((ancestor) => {
      ancestorScroll && ancestor.removeEventListener("scroll", update);
      ancestorResize && ancestor.removeEventListener("resize", update);
    });
    cleanupIo == null || cleanupIo();
    (_resizeObserver2 = resizeObserver) == null || _resizeObserver2.disconnect();
    resizeObserver = null;
    if (animationFrame) {
      cancelAnimationFrame(frameId);
    }
  };
}
var offset2 = offset;
var shift2 = shift;
var flip2 = flip;
var computePosition2 = (reference, floating, options) => {
  const cache = /* @__PURE__ */ new Map();
  const mergedOptions = options != null ? options : {};
  const platformWithCache = {
    ...platform,
    ...mergedOptions.platform,
    _c: cache
  };
  return computePosition(reference, floating, {
    ...mergedOptions,
    platform: platformWithCache
  });
};

// src/client/platform.ts
var react = __toESM(require("react"), 1);
var reactDom = __toESM(require("react-dom"), 1);
var primitives = __toESM(require("@deepseek-ai/dsh-client-ui-primitives"), 1);
var h = react.createElement;
var Fragment2 = react.Fragment;

// src/client/styles.ts
var styles = {
  root: { display: "contents" },
  trigger: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    minWidth: 0,
    maxWidth: "min(360px, 45cqw)",
    height: "28px",
    padding: "0 4px 0 8px",
    border: "none",
    borderRadius: "6px",
    background: "transparent",
    color: "var(--dsw-alias-label-secondary)",
    font: "inherit",
    fontSize: "13px",
    fontWeight: 400,
    lineHeight: "20px",
    cursor: "pointer",
    // 悬停/按下是同一套底色，补一个过渡，避免鼠标扫过时整块闪。
    transition: "background .12s ease, color .12s ease"
  },
  /** hover 与"面板已打开"共用（打开态也有底色，否则看不出它被按住了）。 */
  triggerHover: { background: "var(--dsw-alias-bg-layer-2)" },
  triggerDisabled: { opacity: 0.5, cursor: "default" },
  // 紧凑模式：空间不够时 composer 给座位设 `--dsh-composer-model-text-display: none`。
  // 官方选择器这时只剩一枚前导图标（该变量我们已不再使用，图标按反馈去掉了），
  // 我们改成**始终保留档位**——否则这一格只剩一个 chevron，看起来像坏了。
  triggerText: {
    display: "var(--dsh-composer-model-text-display, block)",
    minWidth: 0,
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis"
  },
  triggerEffort: {
    flexShrink: 1e3,
    minWidth: 0,
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
    // 档位比模型名浅一号：模型名继承触发器的 label-secondary，档位用 label-caption
    // （浅色主题 #adb2b8 / 深色主题 #81858c，官方插件的 triggerEffort 也是这个 token），
    // 这样"模型名 · 档位"在折叠态就分得出主次——原来档位是 brand 色，比模型名还抢眼。
    color: "var(--dsw-alias-label-caption)"
  },
  chevron: { flex: "none", color: "var(--dsw-alias-label-secondary)", transition: "transform .12s" },
  chevronOpen: { transform: "rotate(180deg)" },
  measure: { visibility: "hidden", left: 0, top: 0 },
  menu: {
    position: "fixed",
    zIndex: 1100,
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    // 面板宽度：滑轨宽度 = 面板宽 - 左右各 12px padding。
    // 264px → 224px 后滑轨为 200px（更紧凑，代价是模型名可显示的字符数变少）。
    width: "224px",
    padding: "12px",
    color: "var(--dsw-alias-label-primary)",
    fontSize: "13px",
    lineHeight: "18px"
  },
  // 标题区（居中，参考 Codex 的档位面板）：当前档位在上，模型名在下。
  header: { display: "flex", flexDirection: "column", alignItems: "center", gap: "2px", maxWidth: "100%" },
  // 档位名是面板的主角：比模型名大一号、加一点字重，但它只负责"读"，不抢滑杆的戏。
  headerTitle: {
    maxWidth: "100%",
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
    textAlign: "center",
    color: "var(--dsw-alias-brand-primary)",
    fontSize: "15px",
    fontWeight: 600,
    letterSpacing: "0.01em",
    lineHeight: "20px"
  },
  // 模型名那一行：居中 + › 的下钻入口。hover 只改文字色，不做背景块（参考图里它就是一行普通文字）。
  headerModel: {
    display: "inline-flex",
    alignItems: "center",
    gap: "2px",
    maxWidth: "100%",
    padding: "0 2px",
    border: "none",
    borderRadius: "4px",
    background: "transparent",
    color: "var(--dsw-alias-label-secondary)",
    font: "inherit",
    fontSize: "12px",
    lineHeight: "18px",
    cursor: "pointer"
  },
  headerModelHover: { color: "var(--dsw-alias-label-primary)" },
  headerModelText: { minWidth: 0, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" },
  caption: { color: "var(--dsw-alias-label-secondary)", fontSize: "12px" },
  track: {
    position: "relative",
    // 轨道高度与 THUMB_SIZE 是同一套比例，数值来自参考图（Codex 的档位面板）：
    // 面板 310px 宽时轨道 30px、圆钮 34.5px（占面板宽的 9.7% / 11.1%）；本面板 224px
    // 等比换算就是 22px / 25px，比值 1.14:1，圆钮上下各探出 1.5px。
    // 改这里就要同步看 THUMB_SIZE（见 AGENTS.md 第 3 节）。
    height: "22px",
    borderRadius: "999px",
    // 形状不能只靠 border-radius：实测在 DSH 的 popover 里，我们写的 999px / 50%
    // 会被渲染成约 8px 的圆角（轨道两端成了圆角矩形、圆钮成了圆角方块）。
    // 轨道这里**不能**用 clip-path 兜底——clip-path 会连子节点一起裁，滑块（25px）
    // 上下探出轨道的那 1.5px 会被切平。轨道的兜底交给 `index.ts` 注入的那条
    // `[data-dsh-effort-picker-track]{border-radius:999px!important}`（!important 赢过
    // 任何普通声明，而且不裁子树）。填充/停靠点/滑块内部没有别的东西，直接用 clip-path。
    // 轨道底色不能直接用 bg-layer-2：菜单面是半透明材质（深色主题 #43454a73、
    // 浅色主题 #f8f9fa94），换算出来的面板色跟 bg-layer-2 几乎一样（浅色主题里
    // 两者都是接近白的），轨道会整条"糊"进面板里，看不出滑轨有多长。
    // 掺一档 label-primary（深色主题里是近白、浅色主题里是近黑）就永远比面板
    // 亮/暗一档，两种主题下轨道边界都清清楚楚。
    backgroundColor: "color-mix(in srgb, var(--dsw-alias-label-primary) 10%, var(--dsw-alias-bg-layer-2))",
    boxShadow: "inset 0 0 0 1px var(--dsw-alias-border-l2), inset 0 1px 3px rgba(0, 0, 0, .28)",
    touchAction: "none",
    userSelect: "none"
  },
  trackDisabled: { opacity: 0.55 },
  // 进度填充：从左端一直铺到滑块中心，右端永远被滑块盖住（两者位置同源，不会错位）。
  // 最低档时它整段藏在滑块底下，轨道看上去是空的——与参考图的"轻度"状态一致。
  fill: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    borderRadius: "999px",
    // 同轨道：右端必须是半圆，靠 clip-path 兜住（见 styles.track 的说明）。
    clipPath: "inset(0 round 999px)",
    // 参考图取色：整条轨道是一块**平**的浅蓝——实测 #88c0d0（136/192/208），横向、纵向
    // 都没有渐变，也没有顶部高光和描边。早先那版「brand 55%→100% 渐变 + 白高光」是照着
    // 另一张图猜的，在这张参考图上并不存在，于是改回纯色块。
    // 这是个固定色值（不掺 token）：参考图给的就是这个色，浅色主题下同样是一块浅蓝，
    // 与浅灰轨道仍有色相差，看得见。想跟随主题品牌色就换成
    // `color-mix(in srgb, var(--dsw-alias-brand-primary) 40%, #fff)`，代价是色相随主题漂。
    background: "#88c0d0",
    pointerEvents: "none"
  },
  tick: {
    position: "absolute",
    top: "50%",
    width: "4px",
    height: "4px",
    transform: "translate(-50%, -50%)",
    borderRadius: "50%",
    // 形状靠 clip-path 兜底：宿主的 8px 圆角规则会把 4px 的点压成方块。
    clipPath: "circle(50%)",
    // 参考图里停靠点是"比填充只亮一点点的小白点"：实测 白 28.6% 叠在 #88c0d0 上得
    // 170/210/221，直径约 5px（相对 289px 轨道 1.7%，本轨道 200px → 4px）。
    // 颜色不用裸白，而是「白与 label-primary 混 62%」再降到 34% 透明：
    //   · 深色主题 label-primary 近白 → 落在浅蓝填充上几乎只剩一点点亮（与参考图一致）；
    //   · 浅色主题 label-primary 近黑 → 白点变成浅灰点，压在浅灰轨道上仍看得见。
    // 裸 rgba(255,255,255,.3) 在浅色主题里会彻底消失，这是实测踩过的坑。
    background: "color-mix(in srgb, color-mix(in srgb, #fff 62%, var(--dsw-alias-label-primary)) 34%, transparent)",
    // 不再描边：掺了 label-primary 之后浅色主题里它自己就是个浅灰点，不需要再勾边界；
    // 加一圈 1px 黑描边在浅蓝填充上会变成"灰圈里套亮点"，参考图里并没有这个圈。
    pointerEvents: "none"
  },
  thumb: {
    position: "absolute",
    top: "50%",
    width: "25px",
    height: "25px",
    transform: "translate(-50%, -50%)",
    borderRadius: "50%",
    // 同上：圆钮必须是正圆，clip-path 说了算（宿主的 8px 圆角会把它变成圆角方块）。
    clipPath: "circle(50%)",
    background: "#fff",
    // clip-path 会把**外侧**投影一起裁掉，所以边界改成 inset 描边（画在球内侧，裁不掉）：
    // 浅色主题下白球压浅轨时仍看得出边，深色主题下几乎不可见（与参考图一致）。
    boxShadow: "inset 0 0 0 1px rgba(0, 0, 0, .10)",
    pointerEvents: "none"
  },
  /** 拖动中的圆钮：只把内侧描边加深一点（`track.tsx` 按 `dragging` 切），不做光晕。 */
  thumbActive: { boxShadow: "inset 0 0 0 1px rgba(0, 0, 0, .18)" },
  // 一个 provider 分组：一个**有边框的框**（用户 2026-10-24 明确要求「分组使用框包起来」）。
  // 早先撤掉的是「每行一张 provider 卡片」；现在保留的是「每个 provider 一个框」：
  // 框内模型行仍然平铺，只在组这一层有 1px 边框 + 8px 圆角 + 3% 底色。
  group: {
    display: "flex",
    flexDirection: "column",
    marginTop: "8px",
    border: "1px solid color-mix(in srgb, var(--dsw-alias-label-primary) 10%, transparent)",
    borderRadius: "8px",
    background: "color-mix(in srgb, var(--dsw-alias-label-primary) 3%, transparent)",
    overflow: "hidden"
  },
  // 框头：组名 + 数量。底色比框内再深 1%，底边一条分隔线。
  groupHead: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "6px 8px",
    background: "color-mix(in srgb, var(--dsw-alias-label-primary) 4%, transparent)",
    borderBottom: "1px solid color-mix(in srgb, var(--dsw-alias-label-primary) 7%, transparent)",
    userSelect: "none"
  },
  // 组名文字：flex 子项自己负责省略号（条本身不能 overflow:hidden，否则会裁掉吸顶内容）。
  groupLabelText: {
    minWidth: 0,
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
    color: "var(--dsw-alias-label-secondary)",
    fontSize: "11px",
    fontWeight: 600,
    letterSpacing: "0.03em",
    lineHeight: "16px"
  },
  // 组内模型数：靠右，退回 tertiary，不和组名抢；tabular-nums 让数字右端对齐。
  groupCount: {
    flex: "none",
    marginLeft: "auto",
    color: "var(--dsw-alias-label-tertiary)",
    fontSize: "10px",
    fontWeight: 400,
    letterSpacing: "0",
    lineHeight: "16px",
    fontVariantNumeric: "tabular-nums"
  },
  // 组内每一行是单行：模型名 + 档位 + 勾（用户要求把思考强度放到模型后边，压缩高度）。
  // 行在框内，圆角交给 group 的 overflow:hidden，行本身保持直角，hover 才能铺满整行。
  rowButton: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    width: "100%",
    padding: "6px 8px",
    border: "none",
    borderRadius: 0,
    background: "transparent",
    color: "var(--dsw-alias-label-primary)",
    font: "inherit",
    textAlign: "left",
    cursor: "pointer",
    transition: "background .1s ease"
  },
  // 半透明菜单面上不要用 bg-layer-2（和面板几乎同色，看不出 hover）。
  rowHover: { background: "color-mix(in srgb, var(--dsw-alias-label-primary) 7%, transparent)" },
  /** 当前选中行：比 hover 再深一点，像 Codex 那样一眼看出"我在这"。 */
  rowActive: { background: "color-mix(in srgb, var(--dsw-alias-label-primary) 11%, transparent)" },
  rowDisabled: { opacity: 0.5, cursor: "default" },
  list: {
    display: "flex",
    flexDirection: "column",
    // 行距要小（没有卡片），行本身承担 hover/选中高亮；provider 之间靠组名的
    // `groupLabel` 上内边距拉开，不用额外分隔线。
    gap: "2px",
    maxHeight: "min(320px, 50vh)",
    overflowY: "auto",
    // 列表滚动时不把滚动传给下面的对话列表。滚动条整体隐藏（用户要求），
    // Chromium 的 ::-webkit-scrollbar 由 SHAPE_CSS 里的兜底样式表负责。
    overscrollBehavior: "contain",
    scrollbarWidth: "none",
    msOverflowStyle: "none"
  },
  modelName: {
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
    fontSize: "13px",
    lineHeight: "18px"
  },
  /** 行尾那一格：勾选图标，没有勾选时留同样宽的空格，保证模型名左对齐。 */
  slot: { width: "18px", flex: "none", display: "inline-flex", alignItems: "center", justifyContent: "flex-end" },
  notice: { color: "var(--dsw-alias-label-secondary)", fontSize: "12px", padding: "4px 2px" },
  // provider 级加载失败：没有可选行，但必须让用户看见是哪一家失败了。
  failureRow: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    padding: "6px 8px",
    color: "var(--dsw-alias-state-error-primary)",
    fontSize: "12px",
    lineHeight: "16px"
  },
  error: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
    color: "var(--dsw-alias-state-error-primary)",
    fontSize: "12px",
    padding: "4px 2px"
  },
  retry: {
    flex: "none",
    padding: "2px 4px",
    border: "none",
    borderRadius: "4px",
    background: "transparent",
    color: "var(--dsw-alias-brand-primary)",
    font: "inherit",
    fontSize: "12px",
    cursor: "pointer"
  },
  // 座位内部兜住错误时替换触发器的那一行提示（点击可重试）。
  failure: {
    display: "flex",
    alignItems: "center",
    height: "28px",
    padding: "0 8px",
    border: "none",
    borderRadius: "6px",
    background: "transparent",
    color: "var(--dsw-alias-state-error-primary)",
    font: "inherit",
    fontSize: "13px",
    cursor: "pointer"
  }
};

// src/client/boundary.tsx
var SeatBoundary = class extends react.Component {
  timer;
  retries;
  constructor(props) {
    super(props);
    this.state = { failure: null };
    this.timer = null;
    this.retries = 0;
    this.retry = this.retry.bind(this);
  }
  /** React 边界协议：把抛出的错误转成状态。 */
  static getDerivedStateFromError(error) {
    return { failure: error };
  }
  /**
   * 记录真实错误，并安排一次自动重试。
   *
   * 绝大多数原因是**瞬时**的（目录服务好像还没就绪），所以先自动重试几次；
   * 重试耗尽还失败就停在提示上，等用户点击。控制台只在第一次失败时打一条，
   * 否则重试会把控制台刷屏。
   */
  componentDidCatch(error) {
    const detail = error instanceof Error ? `${error.name}: ${error.message}
${error.stack ?? ""}` : String(error);
    if (this.retries === 0) console.error("[dsh-effort-picker] 座位渲染失败：", error);
    try {
      window.localStorage.setItem("dsh-effort-picker:last-failure", `${(/* @__PURE__ */ new Date()).toISOString()}
${detail}`);
    } catch {
    }
    if (this.retries < 12) {
      this.retries += 1;
      this.timer = setTimeout(this.retry, 150);
    }
  }
  /** 卸载时清掉待重试的定时器。 */
  componentWillUnmount() {
    if (this.timer !== null) clearTimeout(this.timer);
  }
  /** 清掉失败态：子树重新挂载，也就是再解析一次注入面。 */
  retry() {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.setState({ failure: null });
  }
  /** 正常时渲染子树；失败时渲染一行提示。 */
  render() {
    if (this.state.failure === null) return this.props.children;
    const failure = this.state.failure;
    const message = failure instanceof Error ? `${failure.name}: ${failure.message}` : String(failure);
    return /* @__PURE__ */ h("button", { type: "button", style: styles.failure, title: message, onClick: this.retry }, "推理等级控件异常，点击重试");
  }
};

// src/client/hooks.ts
function useHover() {
  const [hovered, setHovered] = react.useState(false);
  return [
    hovered,
    {
      onMouseEnter: () => setHovered(true),
      onMouseLeave: () => setHovered(false)
    }
  ];
}

// src/client/row.tsx
function Row(props) {
  const [hovered, hoverHandlers] = useHover();
  const style = { ...styles.rowButton };
  if (props.checked === true) Object.assign(style, styles.rowActive);
  if (hovered && props.disabled !== true) Object.assign(style, styles.rowHover);
  if (props.disabled === true) Object.assign(style, styles.rowDisabled);
  return /* @__PURE__ */ h(
    "button",
    {
      type: "button",
      role: props.role,
      "aria-checked": props.checked,
      "aria-label": props.ariaLabel,
      title: props.title,
      style,
      disabled: props.disabled === true,
      onClick: props.onClick,
      ...hoverHandlers
    },
    props.children
  );
}

// src/client/geometry.ts
var THUMB_SIZE = 25;
var THUMB_INSET = THUMB_SIZE / 2;
function ratioOf(index, count) {
  if (count <= 1) return 0.5;
  return index / (count - 1);
}
function centerAt(ratio) {
  return `calc(${String(THUMB_INSET)}px + (100% - ${String(THUMB_SIZE)}px) * ${String(ratio)})`;
}
function offsetOf(index, count) {
  return centerAt(ratioOf(index, count));
}
function snapIndex(ratio, count) {
  if (count <= 1) return 0;
  return Math.min(Math.max(Math.round(ratio * (count - 1)), 0), count - 1);
}

// src/client/track.tsx
function EffortTrack(props) {
  const count = props.efforts.length;
  const ticks = [];
  for (let index = 0; index < count; index += 1) {
    ticks.push(
      /* @__PURE__ */ h(
        "span",
        {
          key: `tick-${props.efforts[index].id}`,
          "data-dsh-effort-picker-tick": "",
          style: { ...styles.tick, left: offsetOf(index, count) }
        }
      )
    );
  }
  const thumb = props.shownRatio === null ? null : /* @__PURE__ */ h(
    "span",
    {
      ref: props.thumbRef,
      "data-dsh-effort-picker-thumb": "",
      style: {
        ...styles.thumb,
        ...props.dragging ? styles.thumbActive : {},
        left: centerAt(props.shownRatio),
        // 拖动时 left 由 pointermove 直接写（要的是零延迟），所以过渡只留给"放大"这一下。
        // 参考图里没有光晕可用，按下去只做极轻微的放大（1.04）+ 加深落影，够当按压反馈了。
        transform: `translate(-50%, -50%) scale(${props.dragging ? "1.04" : "1"})`,
        transition: props.dragging ? "transform .12s ease-out" : "left .12s ease-out, transform .12s ease-out"
      }
    }
  );
  const fill = props.shownRatio === null ? null : /* @__PURE__ */ h(
    "span",
    {
      ref: props.fillRef,
      "data-dsh-effort-picker-fill": "",
      style: {
        ...styles.fill,
        width: centerAt(props.shownRatio),
        transition: props.dragging ? "none" : "width .12s ease-out"
      }
    }
  );
  return /* @__PURE__ */ h(
    "div",
    {
      ref: props.trackRef,
      role: "slider",
      "data-dsh-effort-picker-track": "",
      tabIndex: props.locked ? -1 : 0,
      "aria-label": "推理等级",
      "aria-valuemin": 1,
      "aria-valuemax": count,
      "aria-valuenow": props.previewIndex >= 0 ? props.previewIndex + 1 : void 0,
      "aria-valuetext": props.previewIndex >= 0 ? props.efforts[props.previewIndex].name : "未设置",
      style: {
        ...styles.track,
        ...props.locked ? styles.trackDisabled : {},
        cursor: props.locked ? "default" : props.dragging ? "grabbing" : "pointer"
      },
      onPointerDown: props.onPointerDown,
      onPointerMove: props.onPointerMove,
      onPointerUp: props.onPointerUp,
      onPointerCancel: props.onPointerCancel,
      onLostPointerCapture: props.onLostPointerCapture
    },
    fill,
    ticks,
    thumb
  );
}

// src/client/placement.ts
var PANEL_GAP = 8;
var PANEL_MARGIN = 12;
function clamp2(value, min2, max2) {
  return Math.min(Math.max(value, min2), Math.max(min2, max2));
}
function estimatePanelPosition(anchor, size2, viewport, margin = PANEL_MARGIN) {
  const above = anchor.top - PANEL_GAP - size2.height;
  const below = anchor.bottom + PANEL_GAP;
  const top = above >= margin ? above : Math.min(below, viewport.height - size2.height - margin);
  const left = clamp2(anchor.right - size2.width, margin, viewport.width - size2.width - margin);
  return { left, top };
}

// src/client/dom.ts
function writeInlineStyle(node, patch) {
  const style = node?.style;
  if (style === void 0) return;
  Object.assign(style, patch);
}

// src/client/picker.tsx
function CodexEffortPicker(props) {
  return /* @__PURE__ */ h(SeatBoundary, null, /* @__PURE__ */ h(CodexEffortPickerSeat, { ...props }));
}
function CodexEffortPickerSeat(props) {
  const { locked, resolve } = props;
  const resolved = resolve();
  const available = resolved.available;
  const modelDirectory = resolved.directory;
  const directory = modelDirectory.store;
  const load = () => {
    if (available) void modelDirectory.load().catch(() => void 0);
  };
  const select = (selection) => available ? modelDirectory.select(selection) : Promise.resolve(void 0);
  const state = react.useSyncExternalStore(
    (listener) => directory.subscribe(listener),
    () => directory.getSnapshot()
  );
  const [open, setOpen] = react.useState(false);
  const [pane, setPane] = react.useState("root");
  const [menuPos, setMenuPos] = react.useState(null);
  const [dragRatio, setDragRatio] = react.useState(null);
  const [failure, setFailure] = react.useState(null);
  const [hovered, hoverHandlers] = useHover();
  const [modelHovered, modelHoverHandlers] = useHover();
  const rootRef = react.useRef(null);
  const triggerRef = react.useRef(null);
  const menuRef = react.useRef(null);
  const modelButtonRef = react.useRef(null);
  const restoreModelFocus = react.useRef(false);
  const listRef = react.useRef(null);
  const trackRef = react.useRef(null);
  const thumbRef = react.useRef(null);
  const fillRef = react.useRef(null);
  const id = react.useId();
  const current = state.current;
  const currentModel = current === null || current === void 0 ? void 0 : state.groups.find((group) => group.id === current.provider)?.models.find((model) => model.id === current.model);
  const reasoning = currentModel?.reasoning;
  const efforts = reasoning?.efforts ?? [];
  const groups = state.groups.filter((group) => group.models.length > 0);
  const failures = state.failures ?? [];
  const effectiveEffort = current?.reasoningEffort ?? reasoning?.defaultEffort;
  const activeIndex = efforts.findIndex((level) => level.id === effectiveEffort);
  const shownIndex = activeIndex >= 0 ? activeIndex : efforts.length - 1;
  const effortDefaulted = activeIndex < 0 && shownIndex >= 0;
  const previewIndex = dragRatio === null ? shownIndex : snapIndex(dragRatio, efforts.length);
  const shownRatio = dragRatio === null ? shownIndex >= 0 ? ratioOf(shownIndex, efforts.length) : null : dragRatio;
  const titleName = previewIndex >= 0 ? efforts[previewIndex].name : effectiveEffort ?? "默认";
  const effortLabel = reasoning === void 0 ? state.retainedEffort : effortDefaulted ? `${titleName}（默认）` : titleName;
  const committedName = shownIndex >= 0 ? efforts[shownIndex].name : effectiveEffort ?? "默认";
  const committedLabel = reasoning === void 0 ? state.retainedEffort : effortDefaulted ? `${committedName}（默认）` : committedName;
  const modelLabel = current === null || current === void 0 ? state.status === "loading" ? "载入中…" : "选择模型" : currentModel?.name ?? `${current.provider}/${current.model}`;
  const busy = state.pending !== null && state.pending !== void 0;
  const triggerLocked = locked === true;
  const controlsLocked = triggerLocked || busy;
  const message = failure ?? state.error ?? null;
  const activeElement = () => {
    const active = typeof document === "undefined" ? null : document.activeElement;
    return active !== null && typeof active === "object" && "focus" in active ? active : null;
  };
  const queryAll = (root, selector) => {
    if (root === null || typeof root.querySelectorAll !== "function") return [];
    return Array.from(root.querySelectorAll(selector));
  };
  const focusables = () => {
    const nodes = [];
    if (triggerRef.current !== null && triggerRef.current.disabled !== true) nodes.push(triggerRef.current);
    if (menuRef.current !== null) {
      nodes.push(...queryAll(
        menuRef.current,
        'button:not([disabled]), input:not([disabled]), [role="slider"][tabindex="0"]'
      ));
    }
    return nodes;
  };
  const modelRows = () => queryAll(listRef.current, "button:not([disabled])");
  const modelChoices = () => queryAll(listRef.current, '[role="menuitemradio"]:not([disabled])');
  react.useEffect(() => {
    if (!open) return void 0;
    const closeOutside = (event) => {
      const target = event.target;
      if (rootRef.current?.contains(target) === true) return;
      if (menuRef.current?.contains(target) === true) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", closeOutside);
    return () => document.removeEventListener("mousedown", closeOutside);
  }, [open]);
  react.useEffect(() => {
    if (!open) {
      setMenuPos(null);
      return void 0;
    }
    const trigger2 = triggerRef.current;
    const menu = menuRef.current;
    if (trigger2 !== null) {
      setMenuPos(
        estimatePanelPosition(
          trigger2.getBoundingClientRect(),
          { width: menu?.offsetWidth ?? 0, height: menu?.offsetHeight ?? 0 },
          { width: window.innerWidth, height: window.innerHeight }
        )
      );
    }
    if (trigger2 === null || menu === null) return void 0;
    const update = () => {
      void computePosition2(trigger2, menu, {
        placement: "top-end",
        strategy: "fixed",
        middleware: [offset2(PANEL_GAP), flip2({ padding: PANEL_MARGIN }), shift2({ padding: PANEL_MARGIN })]
      }).then(({ x, y }) => setMenuPos({ left: x, top: y }));
    };
    return autoUpdate(trigger2, menu, update);
  }, [open, pane, efforts.length]);
  react.useEffect(() => {
    if (!open || pane !== "model") return void 0;
    const checked = listRef.current?.querySelector(
      '[role="menuitemradio"][aria-checked="true"]:not([disabled])'
    ) ?? null;
    (checked ?? modelChoices()[0] ?? modelRows()[0])?.focus();
    return void 0;
  }, [open, pane]);
  react.useEffect(() => {
    if (!open) {
      restoreModelFocus.current = false;
      return;
    }
    if (pane !== "root" || !restoreModelFocus.current) return;
    restoreModelFocus.current = false;
    modelButtonRef.current?.focus();
  }, [open, pane]);
  if (!available) return null;
  const show = () => {
    triggerRef.current?.focus();
    setFailure(null);
    setDragRatio(null);
    setPane("root");
    setOpen(true);
    load();
  };
  const close = (restoreFocus) => {
    setOpen(false);
    setPane("root");
    setDragRatio(null);
    if (restoreFocus === true) queueMicrotask(() => triggerRef.current?.focus());
  };
  const moveTab = (direction) => {
    const nodes = focusables();
    if (nodes.length === 0) return;
    const active = activeElement();
    const index = active === null ? -1 : nodes.indexOf(active);
    const next = index === -1 ? direction > 0 ? 0 : nodes.length - 1 : (index + direction + nodes.length) % nodes.length;
    nodes[next]?.focus();
  };
  const moveModelFocus = (direction) => {
    const rows = modelRows();
    if (rows.length === 0) return;
    const active = activeElement();
    const index = active === null ? -1 : rows.indexOf(active);
    const next = index === -1 ? direction > 0 ? 0 : rows.length - 1 : (index + direction + rows.length) % rows.length;
    rows[next]?.focus();
  };
  const backToRoot = () => {
    restoreModelFocus.current = true;
    setPane("root");
  };
  const onRootBlur = (event) => {
    if (!open) return;
    const next = event.relatedTarget;
    if (next !== null && (rootRef.current?.contains(next) === true || menuRef.current?.contains(next) === true)) return;
    queueMicrotask(() => {
      const active = activeElement();
      if (active !== null && (rootRef.current?.contains(active) === true || menuRef.current?.contains(active) === true)) return;
      close();
    });
  };
  const settle = (outcome, onOk) => {
    if (outcome === void 0 || outcome.ok === true) {
      onOk?.();
      return;
    }
    const code = outcome.error.code ?? "unknown";
    setFailure(
      code === "session/writer-held" ? "另一个 DSH 实例正在写这个会话，请先退出它再重试" : `${code}: ${outcome.error.message ?? ""}`
    );
  };
  const commitEffort = (index) => {
    if (controlsLocked || current === null || current === void 0) return;
    const level = efforts[index];
    if (level === void 0 || level.id === effectiveEffort) return;
    setFailure(null);
    triggerRef.current?.focus();
    Promise.resolve(select({ provider: current.provider, model: current.model, reasoningEffort: level.id })).then(
      (outcome) => settle(outcome),
      (reason) => setFailure(String(reason))
    );
  };
  const ratioAt = (event) => {
    const node = trackRef.current;
    if (node === null || efforts.length === 0) return null;
    const rect = node.getBoundingClientRect();
    const usable = rect.width - THUMB_SIZE;
    if (usable <= 0) return null;
    return Math.min(Math.max((event.clientX - rect.left - THUMB_INSET) / usable, 0), 1);
  };
  const onPointerDown = (event) => {
    if (controlsLocked || efforts.length === 0) return;
    if (event.button !== 0 || event.isPrimary === false) return;
    const ratio = ratioAt(event);
    if (ratio === null) return;
    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
    }
    setDragRatio(ratio);
  };
  const onPointerMove = (event) => {
    if (dragRatio === null) return;
    const ratio = ratioAt(event);
    if (ratio === null) return;
    writeInlineStyle(thumbRef.current, { left: centerAt(ratio) });
    writeInlineStyle(fillRef.current, { width: centerAt(ratio) });
    setDragRatio(ratio);
  };
  const onPointerUp = (event) => {
    if (dragRatio === null) return;
    const ratio = ratioAt(event);
    setDragRatio(null);
    if (controlsLocked) return;
    commitEffort(snapIndex(ratio === null ? dragRatio : ratio, efforts.length));
  };
  const onPointerCancel = () => {
    setDragRatio(null);
  };
  const onRootKeyDown = (event) => {
    if (event.nativeEvent?.isComposing === true) return;
    if (!open) return;
    if (event.key === "Escape") {
      event.preventDefault();
      if (pane !== "root") backToRoot();
      else close(true);
      return;
    }
    const active = activeElement();
    if (event.key === "Tab") {
      event.preventDefault();
      if (event.shiftKey) {
        if (pane !== "root") backToRoot();
        else close(true);
        return;
      }
      moveTab(1);
      return;
    }
    if (event.key === void 0) return;
    const inList = listRef.current !== null && active !== null && listRef.current.contains(active);
    if (inList && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      event.preventDefault();
      moveModelFocus(event.key === "ArrowDown" ? 1 : -1);
      return;
    }
    if (inList && (event.key === "Home" || event.key === "End")) {
      event.preventDefault();
      const choices = modelChoices();
      choices[event.key === "Home" ? 0 : choices.length - 1]?.focus();
      return;
    }
    if (inList) return;
    if (pane === "model" && active === modelButtonRef.current && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      event.preventDefault();
      const choices = modelChoices();
      const target = choices.length > 0 ? choices[event.key === "ArrowDown" ? 0 : choices.length - 1] : modelRows()[0];
      target?.focus();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      moveTab(event.key === "ArrowDown" ? 1 : -1);
      return;
    }
    const onEffortControl = active === null || active === triggerRef.current || active === trackRef.current;
    if (!onEffortControl) return;
    if (event.key === "Home") {
      event.preventDefault();
      commitEffort(0);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      commitEffort(efforts.length - 1);
      return;
    }
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const step = event.key === "ArrowRight" ? 1 : -1;
    const from = activeIndex < 0 ? step > 0 ? -1 : efforts.length : activeIndex;
    commitEffort(Math.min(Math.max(from + step, 0), efforts.length - 1));
  };
  const chooseModel = (group, model) => {
    if (controlsLocked) return;
    if (model.id === current?.model && group.id === current?.provider) {
      backToRoot();
      return;
    }
    setFailure(null);
    triggerRef.current?.focus();
    const selection = { provider: group.id, model: model.id };
    const levels = model.reasoning?.efforts ?? [];
    if (levels.length > 0) selection.reasoningEffort = levels[levels.length - 1].id;
    Promise.resolve(select(selection)).then(
      (outcome) => settle(outcome, backToRoot),
      (reason) => setFailure(String(reason))
    );
  };
  const triggerStyle = { ...styles.trigger };
  if ((hovered || open) && !triggerLocked) Object.assign(triggerStyle, styles.triggerHover);
  if (triggerLocked) Object.assign(triggerStyle, styles.triggerDisabled);
  const modelLineStyle = { ...styles.headerModel };
  if (modelHovered && !controlsLocked) Object.assign(modelLineStyle, styles.headerModelHover);
  if (controlsLocked) Object.assign(modelLineStyle, styles.rowDisabled);
  const trigger = /* @__PURE__ */ h(
    "button",
    {
      ref: triggerRef,
      type: "button",
      "aria-label": current === null || current === void 0 ? "选择模型" : `选择模型和推理等级，当前 ${modelLabel}，推理等级 ${committedLabel ?? "默认"}`,
      "aria-haspopup": "dialog",
      "aria-expanded": open,
      "aria-controls": open ? `${id}-menu` : void 0,
      title: `${modelLabel} · ${committedLabel ?? "默认"}`,
      "aria-busy": busy,
      disabled: triggerLocked,
      style: triggerStyle,
      onClick: () => {
        if (open) close(true);
        else show();
      },
      ...hoverHandlers
    },
    /* @__PURE__ */ h("span", { style: styles.triggerText }, modelLabel),
    committedLabel === void 0 ? null : /* @__PURE__ */ h("span", { style: styles.triggerEffort }, committedLabel),
    busy ? /* @__PURE__ */ h(primitives.StateDot, { state: "ongoing" }) : /* @__PURE__ */ h(
      primitives.IconChevronDownOutlineRegular,
      {
        style: { ...styles.chevron, ...open ? styles.chevronOpen : {} }
      }
    )
  );
  const panel = open === false ? null : reactDom.createPortal(
    /* @__PURE__ */ h(
      primitives.MenuSurface,
      {
        ref: menuRef,
        id: `${id}-menu`,
        compact: true,
        role: "dialog",
        "aria-label": "模型与推理等级",
        "aria-busy": busy || state.status === "loading",
        style: { ...styles.menu, ...menuPos ?? styles.measure }
      },
      pane === "root" ? /* @__PURE__ */ h(Fragment2, null, /* @__PURE__ */ h("div", { style: styles.header }, /* @__PURE__ */ h("div", { style: styles.headerTitle, title: effortLabel ?? "默认" }, effortLabel ?? "默认"), /* @__PURE__ */ h(
        "button",
        {
          ref: modelButtonRef,
          type: "button",
          "aria-label": `选择模型，当前 ${modelLabel}`,
          "aria-haspopup": "menu",
          "aria-expanded": false,
          title: modelLabel,
          disabled: controlsLocked,
          style: modelLineStyle,
          onClick: () => setPane("model"),
          ...modelHoverHandlers
        },
        /* @__PURE__ */ h("span", { style: styles.headerModelText }, modelLabel),
        /* @__PURE__ */ h(primitives.IconChevronRightOutlineRegular, { size: 12 })
      )), efforts.length === 0 ? /* @__PURE__ */ h("div", { style: styles.notice }, reasoning === void 0 ? "该模型未提供推理等级" : "该模型暂无可选档位") : /* @__PURE__ */ h(
        EffortTrack,
        {
          trackRef,
          thumbRef,
          fillRef,
          efforts,
          previewIndex,
          shownRatio,
          dragging: dragRatio !== null,
          locked: controlsLocked,
          onPointerDown,
          onPointerMove,
          onPointerUp,
          onPointerCancel,
          onLostPointerCapture: onPointerCancel
        }
      )) : null,
      pane === "model" ? /* @__PURE__ */ h("div", { style: styles.list, "data-dsh-effort-picker-list": true }, /* @__PURE__ */ h("div", { ref: listRef, id: `${id}-models`, role: "menu", "aria-label": "模型列表" }, /* @__PURE__ */ h(Row, { role: "menuitem", onClick: backToRoot }, /* @__PURE__ */ h(primitives.IconChevronLeftOutlineRegular, { size: 14, style: styles.chevron }), /* @__PURE__ */ h("span", { style: styles.caption }, "返回")), groups.map((group) => /* @__PURE__ */ h(
        "div",
        {
          key: group.id,
          role: "group",
          "aria-label": group.name ?? group.id,
          style: styles.group
        },
        /* @__PURE__ */ h("div", { style: styles.groupHead }, /* @__PURE__ */ h("span", { style: styles.groupLabelText, "aria-hidden": "true" }, group.name ?? group.id), /* @__PURE__ */ h("span", { style: styles.groupCount, "aria-hidden": "true" }, String(group.models.length))),
        group.models.map((model) => {
          const isCurrent = current?.provider === group.id && current?.model === model.id;
          const isPending = busy && state.pending?.provider === group.id && state.pending?.model === model.id;
          const levelCount = model.reasoning?.efforts.length ?? 0;
          const providerName = group.name ?? group.id;
          return /* @__PURE__ */ h(
            Row,
            {
              key: `${group.id}/${model.id}`,
              role: "menuitemradio",
              checked: isCurrent,
              disabled: controlsLocked,
              ariaLabel: `${model.name ?? model.id}，${providerName}`,
              title: levelCount === 0 ? void 0 : `${String(levelCount)} 档可选`,
              onClick: () => chooseModel(group, model)
            },
            /* @__PURE__ */ h("span", { style: styles.modelName }, model.name ?? model.id),
            /* @__PURE__ */ h("span", { style: styles.slot }, isPending ? /* @__PURE__ */ h(primitives.StateDot, { state: "ongoing" }) : isCurrent ? /* @__PURE__ */ h(primitives.IconCheckOutlineRegular, { size: 14 }) : null)
          );
        })
      ))), groups.length === 0 && failures.length === 0 ? /* @__PURE__ */ h("div", { style: styles.notice, role: "status" }, state.status === "loading" ? "正在载入模型…" : "暂无可用模型") : null, failures.map((entry) => /* @__PURE__ */ h("div", { key: `failure-${entry.id}`, style: styles.failureRow, role: "status" }, /* @__PURE__ */ h("span", { style: styles.modelName }, entry.name ?? entry.id), /* @__PURE__ */ h("span", { style: styles.caption }, entry.message)))) : null,
      message === null ? null : /* @__PURE__ */ h("div", { style: styles.error, role: "status" }, /* @__PURE__ */ h("span", null, message), failure === null && state.error !== null ? /* @__PURE__ */ h("button", { type: "button", style: styles.retry, onClick: load }, "重试") : null)
    ),
    document.body
  );
  return /* @__PURE__ */ h(
    "div",
    {
      ref: rootRef,
      style: styles.root,
      onKeyDown: onRootKeyDown,
      onBlur: onRootBlur,
      onMouseDown: (event) => {
        if (event.target instanceof Element && event.target.closest("button") !== null) {
          event.preventDefault();
        }
      }
    },
    trigger,
    panel
  );
}

// src/client/index.ts
var SHAPE_CSS = [
  "[data-dsh-effort-picker-track]{border-radius:999px!important}",
  "[data-dsh-effort-picker-fill]{border-radius:999px!important}",
  "[data-dsh-effort-picker-tick]{border-radius:50%!important}",
  "[data-dsh-effort-picker-thumb]{border-radius:50%!important}",
  "[data-dsh-effort-picker-list]{scrollbar-width:none!important;-ms-overflow-style:none!important}",
  "[data-dsh-effort-picker-list]::-webkit-scrollbar{display:none!important;width:0!important;height:0!important}"
].join("");
function installShapeStyles() {
  if (typeof document === "undefined") return () => {
  };
  const head = document.head;
  if (head === void 0) return () => {
  };
  const style = document.createElement("style");
  style.setAttribute("data-dsh-effort-picker", "shape");
  style.textContent = SHAPE_CSS;
  head.appendChild(style);
  return () => style.remove();
}
function apply(ctx) {
  ctx.effect(installShapeStyles);
  ctx.inject(["slots", "modelDirectories", "sessions", "remote", "remote.session"], (scope) => {
    const models = scope.modelDirectories;
    const sessions = scope.sessions;
    scope.slots.inject(
      "conversation.input.model",
      () => scope.slots.register(
        {
          name: "conversation.input.model",
          // 官方注册在 priority 0；single 座位取"priority 最低者渲染"，
          // 所以 -1 就能接管渲染，而官方插件与它的 /model 命令完全不受影响。
          priority: -1,
          // 只交出**解析闭包**，绝不在这里解析。
          //
          // 理由有两条：
          // 1. inject 工厂抛错会撞上遮蔽规则（见 boundary.tsx），条目被退役；
          // 2. 解析本身就是"可能失败"的动作——会话的目录服务按需创建，
          //    官方 directoryFor() 对没有 retained generation 的会话是 fail loud。
          // 推迟到渲染期，由座位内的 SeatBoundary 兜住并自动重试。
          inject: (sessionId) => ({
            resolve: () => {
              const directory = models.directoryFor(sessionId);
              return {
                available: sessions.subagentAddress(sessionId) === void 0,
                directory
              };
            }
          })
        },
        CodexEffortPicker
      )
    );
  });
}

		return module.exports;
	},
});

