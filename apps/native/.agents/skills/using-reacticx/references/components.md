# Reacticx Component Catalog

> Source: https://github.com/rit3zh/reacticx  
> Full docs: https://www.reacticx.com/docs  
> 95+ animated, gesture-driven React Native components — all Expo compatible.

## How to add a component

```bash
# Configure outDir in component.config.json first, then:
npx reacticx add <cli-key>

# Add with explicit dir
npx reacticx add <cli-key> --dir src/components/ui

# List all available components
npx reacticx list

# List by category
npx reacticx list -c molecules
```

> Use `bunx`, `npx`, or `pnpm dlx` depending on your package manager.

## Package name notes

| Reacticx dep name | npm package |
|---|---|
| `react-native-blur` | `sbaiahmed1/react-native-blur` (GitHub fork — **not** `react-native-blur` on npm) |
| `react-native-skia` | `@shopify/react-native-skia` |
| `react-native-masked-view` | `@react-native-masked-view/masked-view` |
| `expo-vector-icons` | `@expo/vector-icons` |

> After adding any **native dependency**, rebuild the native target (e.g., `npx expo run:ios`) — Metro restart alone is not enough.

---

## Base (19 components)

### animated-input-bar
**Name:** Animated Input Bar  
**Description:** Animated text-input with rotating staggered placeholders.  
**CLI key:** `animated-input-bar`  
**Dependencies:** `react-native-reanimated`  
**Docs:** https://reacticx.com/docs/components/animated-input-bar

---

### avatar
**Name:** Avatar  
**Description:** Flexible avatar component with image support.  
**CLI key:** `avatar`  
**Dependencies:** `react-native-reanimated`  
**Docs:** https://reacticx.com/docs/components/avatar

---

### avatar-group
**Name:** Avatar Group  
**Description:** Interactive group of overlapping avatars.  
**CLI key:** `avatar-group`  
**Dependencies:** `react-native-reanimated`  
**Docs:** https://reacticx.com/docs/components/avatar-group

---

### badge
**Name:** Badge  
**Description:** Small versatile badge component for counts or status.  
**CLI key:** `badge`  
**Dependencies:** `react-native-reanimated`  
**Docs:** https://reacticx.com/docs/components/badge

---

### button
**Name:** Button  
**Description:** Customizable button with press animation and optional gradient.  
**CLI key:** `button`  
**Dependencies:** `react-native-reanimated`, `expo-linear-gradient`  
**Docs:** https://reacticx.com/docs/components/button

---

### curved-bottom-tabs
**Name:** Curved Bottom Tabs  
**Description:** Customizable animated tab bar with a curved active indicator.  
**CLI key:** `curved-bottom-tabs`  
**Dependencies:** `react-native-reanimated`, `react-native-svg`, `@react-navigation/bottom-tabs`  
**Docs:** https://reacticx.com/docs/components/curved-bottom-tabs

---

### empty-state
**Name:** Empty State  
**Description:** Simple screen to display a message, image or button when there's no content.  
**CLI key:** `empty-state`  
**Dependencies:** none (React Native only)  
**Docs:** https://reacticx.com/docs/components/empty-state

---

### flip-card
**Name:** Flip Card  
**Description:** 3D flip card that smoothly rotates on tap.  
**CLI key:** `flip-card`  
**Dependencies:** `react-native-reanimated`, `expo-haptics`, `sbaiahmed1/react-native-blur`  
**Docs:** https://reacticx.com/docs/components/flip-card

---

### glow
**Name:** Glow  
**Description:** Animated glow outline that wraps any element.  
**CLI key:** `glow`  
**Dependencies:** `react-native-reanimated`, `react-native-svg`  
**Docs:** https://reacticx.com/docs/components/glow

---

### marquee
**Name:** Marquee  
**Description:** Smooth looping marquee that scrolls content horizontally.  
**CLI key:** `marquee`  
**Dependencies:** `react-native-reanimated`  
**Docs:** https://reacticx.com/docs/components/marquee

---

### otp-input
**Name:** OTP Input  
**Description:** Animated OTP input with auto-focus between fields.  
**CLI key:** `otp-input`  
**Dependencies:** `react-native-reanimated`  
**Docs:** https://reacticx.com/docs/components/otp-input

---

### qr-code
**Name:** QR Code  
**Description:** Tap-to-expand QR view that smoothly morphs open.  
**CLI key:** `qr-code`  
**Dependencies:** `react-native-reanimated`, `expo-blur`, `@expo/vector-icons`, `react-native-qrcode-styled`  
**Docs:** https://reacticx.com/docs/components/qr-code

---

### radiant-button
**Name:** Radiant Button  
**Description:** Skia-powered animated button with a moving shimmer effect.  
**CLI key:** `radiant-button`  
**Dependencies:** `react-native-reanimated`, `@shopify/react-native-skia`  
**Docs:** https://reacticx.com/docs/components/radiant-button

---

### ripple
**Name:** Ripple  
**Description:** Touchable ripple wrapper for any child element.  
**CLI key:** `ripple`  
**Dependencies:** `react-native-reanimated`, `react-native-worklets`, `react-native-gesture-handler`, `expo-blur`  
**Docs:** https://reacticx.com/docs/components/ripple

---

### ruler
**Name:** Ruler  
**Description:** Smooth draggable ruler with animated tick marks.  
**CLI key:** `ruler`  
**Dependencies:** `react-native-reanimated`, `react-native-worklets`, `react-native-gesture-handler`, `@shopify/react-native-skia`, `expo-haptics`  
**Docs:** https://reacticx.com/docs/components/ruler

---

### scrollable-search
**Name:** Scrollable Search  
**Description:** Pull-to-search layout with smooth scroll animations.  
**CLI key:** `scrollable-search`  
**Dependencies:** `react-native-reanimated`, `react-native-worklets`, `react-native-safe-area-context`, `expo-blur`  
**Docs:** https://reacticx.com/docs/components/scrollable-search

---

### stack-aware-tabs
**Name:** Stack Aware Tabs  
**Description:** Modern bottom tab bar with animated focus scaling.  
**CLI key:** `stack-aware-tabs`  
**Dependencies:** `react-native-reanimated`, `react-native-worklets`, `react-native-gesture-handler`  
**Docs:** https://reacticx.com/docs/components/stack-aware-tabs

---

### tabs
**Name:** Tabs  
**Description:** Animated top tabs layout.  
**CLI key:** `tabs`  
**Dependencies:** `react-native-reanimated`, `sbaiahmed1/react-native-blur`  
**Docs:** https://reacticx.com/docs/components/tabs

---

### title
**Name:** Title  
**Description:** Flexible title text component with multiple heading levels.  
**CLI key:** `title`  
**Dependencies:** none (React Native only)  
**Docs:** https://reacticx.com/docs/components/title

---

## Micro Interactions (9 components)

### countdown
**Name:** Animated Countdown  
**Description:** Highly customizable countdown timer with per-character staggered animation.  
**CLI key:** `countdown`  
**Dependencies:** `react-native-reanimated`  
**Docs:** https://reacticx.com/docs/components/countdown

---

### animated-scroll-progress
**Name:** Animated Scroll Progress  
**Description:** Scroll progress wrapper that reveals a floating action button as you scroll.  
**CLI key:** `animated-scroll-progress`  
**Dependencies:** `react-native-reanimated`, `react-native-worklets`  
**Docs:** https://reacticx.com/docs/components/animated-scroll-progress

---

### animated-theme-toggle
**Name:** Animated Theme Toggle  
**Description:** Smooth animated theme toggle button made with SVG.  
**CLI key:** `animated-theme-toggle`  
**Dependencies:** `react-native-reanimated`, `react-native-svg`  
**Docs:** https://reacticx.com/docs/components/animated-theme-toggle

---

### elastic-slider
**Name:** Elastic Slider  
**Description:** Elastic slider with smooth drag interactions.  
**CLI key:** `elastic-slider`  
**Dependencies:** `react-native-reanimated`, `react-native-worklets`, `react-native-gesture-handler`  
**Docs:** https://reacticx.com/docs/components/elastic-slider

---

### flexi-button
**Name:** Flexi Button  
**Description:** Compact animated button that expands from an icon into text.  
**CLI key:** `flexi-button`  
**Dependencies:** `react-native-reanimated`, `@expo/vector-icons`, `expo-blur`  
**Docs:** https://reacticx.com/docs/components/flexi-button

---

### gooey-switch
**Name:** Gooey Switch  
**Description:** Gooey toggle switch with fluid blobs.  
**CLI key:** `gooey-switch`  
**Dependencies:** `react-native-reanimated`, `react-native-gesture-handler`, `expo-blur`, `@shopify/react-native-skia`, `@expo/vector-icons`, `react-native-worklets`, `expo-symbols`  
**Docs:** https://reacticx.com/docs/components/gooey-switch

---

### hamburger
**Name:** Hamburger  
**Description:** Animated menu icon that smoothly morphs into a close (×) icon.  
**CLI key:** `hamburger`  
**Dependencies:** `react-native-reanimated`, `expo-blur`  
**Docs:** https://reacticx.com/docs/components/hamburger

---

### spin-button
**Name:** Spin Button  
**Description:** Pressable button that switches to a loading spinner state.  
**CLI key:** `spin-button`  
**Dependencies:** `react-native-reanimated`  
**Docs:** https://reacticx.com/docs/components/spin-button

---

### stacked-chips
**Name:** Stacked Chips  
**Description:** Stacked chip menu where each chip expands sideways on tap.  
**CLI key:** `stacked-chips`  
**Dependencies:** `react-native-reanimated`, `expo-blur`, `expo-haptics`  
**Docs:** https://reacticx.com/docs/components/stacked-chips

---

## Molecules (29 components)

### accordion
**Name:** Accordion  
**Description:** Customizable accordion with smooth expand and collapse animation.  
**CLI key:** `accordion`  
**Dependencies:** `react-native-reanimated`, `expo-haptics`, `sbaiahmed1/react-native-blur`  
**Docs:** https://reacticx.com/docs/components/accordion

---

### animated-masked-text
**Name:** Animated Masked Text  
**Description:** Animated chip selector where items expand on selection.  
**CLI key:** `animated-masked-text`  
**Dependencies:** `expo-linear-gradient`, `@react-native-masked-view/masked-view`  
**Docs:** https://reacticx.com/docs/components/animated-masked-text

---

### aurora
**Name:** Aurora  
**Description:** Skia-based animated aurora effect — flowing light waves over a soft sky gradient.  
**CLI key:** `aurora`  
**Dependencies:** `react-native-reanimated`, `@shopify/react-native-skia`  
**Docs:** https://reacticx.com/docs/components/aurora

---

### blur-carousel
**Name:** Blur Carousel  
**Description:** Horizontal carousel where items scale and fade with a soft blur.  
**CLI key:** `blur-carousel`  
**Dependencies:** `react-native-reanimated`, `sbaiahmed1/react-native-blur`  
**Docs:** https://reacticx.com/docs/components/blur-carousel

---

### cinematic-carousel
**Name:** Cinematic Carousel  
**Description:** Horizontal carousel with a cinematic feel and depth effect.  
**CLI key:** `cinematic-carousel`  
**Dependencies:** `react-native-reanimated`, `sbaiahmed1/react-native-blur`  
**Docs:** https://reacticx.com/docs/components/cinematic-carousel

---

### circle-loader
**Name:** Circle Loader  
**Description:** Three dots animating in a wave pattern.  
**CLI key:** `circle-loader`  
**Dependencies:** `react-native-reanimated`, `react-native-svg`  
**Docs:** https://reacticx.com/docs/components/circle-loader

---

### circular-carousel
**Name:** Circular Carousel  
**Description:** Circular-style carousel where cards rotate, scale and blur.  
**CLI key:** `circular-carousel`  
**Dependencies:** `react-native-reanimated`, `expo-blur`  
**Docs:** https://reacticx.com/docs/components/circular-carousel

---

### circular-list
**Name:** Circular List  
**Description:** Circular scrolling image list.  
**CLI key:** `circular-list`  
**Dependencies:** `react-native-reanimated`, `react-native-worklets`, `expo-blur`, `expo-haptics`  
**Docs:** https://reacticx.com/docs/components/circular-list

---

### circular-loader
**Name:** Circular Loader  
**Description:** Circular loader that rotates with optional gradient.  
**CLI key:** `circular-loader`  
**Dependencies:** `react-native-reanimated`, `react-native-svg`  
**Docs:** https://reacticx.com/docs/components/circular-loader

---

### disclosure-group
**Name:** Disclosure Group  
**Description:** Expandable disclosure group (FAQ-style).  
**CLI key:** `disclosure-group`  
**Dependencies:** `react-native-reanimated`, `react-native-worklets`  
**Docs:** https://reacticx.com/docs/components/disclosure-group

---

### dynamic-island
**Name:** Dynamic Island  
**Description:** Dynamic Island–inspired component built purely in Reanimated.  
**CLI key:** `dynamic-island`  
**Dependencies:** `react-native-reanimated`, `expo-haptics`, `expo-blur`  
**Docs:** https://reacticx.com/docs/components/dynamic-island

---

### dynamic-text
**Name:** Dynamic Text  
**Description:** Animated text that cycles through items with smooth transitions.  
**CLI key:** `dynamic-text`  
**Dependencies:** `react-native-reanimated`, `expo-blur`  
**Docs:** https://reacticx.com/docs/components/dynamic-text

---

### gooey-text
**Name:** Gooey Text  
**Description:** Morphing text that smoothly blends between words using a gooey blur.  
**CLI key:** `gooey-text`  
**Dependencies:** `react-native-reanimated`, `@shopify/react-native-skia`  
**Docs:** https://reacticx.com/docs/components/gooey-text

---

### material-carousel
**Name:** Material Carousel  
**Description:** Material-inspired horizontal carousel.  
**CLI key:** `material-carousel`  
**Dependencies:** `react-native-reanimated`  
**Docs:** https://reacticx.com/docs/components/material-carousel

---

### orbiting-dots
**Name:** Orbitdot Loader  
**Description:** Pulsating center circle with multiple orbiting dots.  
**CLI key:** `orbiting-dots`  
**Dependencies:** `react-native-reanimated`, `react-native-svg`  
**Docs:** https://reacticx.com/docs/components/orbiting-dots

---

### parallax-carousel
**Name:** Parallax Carousel  
**Description:** Horizontally paging carousel where images shift at a different speed than the scroll.  
**CLI key:** `parallax-carousel`  
**Dependencies:** `react-native-reanimated`, `expo-haptics`, `react-native-worklets`  
**Docs:** https://reacticx.com/docs/components/parallax-carousel

---

### pulsing-dots
**Name:** Pulsing Loader  
**Description:** Multiple dots that smoothly pulse in a sequence.  
**CLI key:** `pulsing-dots`  
**Dependencies:** `react-native-reanimated`, `react-native-svg`  
**Docs:** https://reacticx.com/docs/components/pulsing-dots

---

### rotate-carousel
**Name:** Rotate Carousel  
**Description:** Horizontal carousel where items rotate in 3D as you scroll.  
**CLI key:** `rotate-carousel`  
**Dependencies:** `react-native-reanimated`, `expo-haptics`, `react-native-worklets`  
**Docs:** https://reacticx.com/docs/components/rotate-carousel

---

### rotating-square
**Name:** Rotating Square  
**Description:** Four squares that rotate in an animated pattern.  
**CLI key:** `rotating-square`  
**Dependencies:** `react-native-reanimated`, `react-native-svg`  
**Docs:** https://reacticx.com/docs/components/rotating-square

---

### scale-carousel
**Name:** Scale Carousel  
**Description:** Horizontal carousel where items scale as you scroll.  
**CLI key:** `scale-carousel`  
**Dependencies:** `react-native-reanimated`, `expo-haptics`, `react-native-worklets`  
**Docs:** https://reacticx.com/docs/components/scale-carousel

---

### search-bar
**Name:** Search Bar  
**Description:** Animated search bar with smooth focus transitions.  
**CLI key:** `search-bar`  
**Dependencies:** `react-native-reanimated`, `react-native-worklets`, `expo-blur`, `@expo/vector-icons`  
**Docs:** https://reacticx.com/docs/components/search-bar

---

### spinner-arc
**Name:** Spinner Arc  
**Description:** Rotating arc with a gradient that spins continuously.  
**CLI key:** `spinner-arc`  
**Dependencies:** `react-native-reanimated`, `react-native-svg`  
**Docs:** https://reacticx.com/docs/components/spinner-arc

---

### split-view
**Name:** Split View  
**Description:** Resizable split layout with two stacked sections.  
**CLI key:** `split-view`  
**Dependencies:** `react-native-reanimated`, `react-native-gesture-handler`, `react-native-safe-area-context`  
**Docs:** https://reacticx.com/docs/components/split-view

---

### squiggly-slider
**Name:** Squiggly Slider  
**Description:** Skia-powered animated slider with a flowing sine wave.  
**CLI key:** `squiggly-slider`  
**Dependencies:** `react-native-reanimated`, `react-native-gesture-handler`, `@shopify/react-native-skia`, `react-native-worklets`  
**Docs:** https://reacticx.com/docs/components/squiggly-slider

---

### stepper
**Name:** Stepper  
**Description:** Animated stepper with plus/minus buttons.  
**CLI key:** `stepper`  
**Dependencies:** `react-native-reanimated`, `@expo/vector-icons`  
**Docs:** https://reacticx.com/docs/components/stepper

---

### tilt-carousel
**Name:** Tilt Carousel  
**Description:** Horizontal carousel where items tilt and lift as you scroll.  
**CLI key:** `tilt-carousel`  
**Dependencies:** `react-native-reanimated`, `sbaiahmed1/react-native-blur`  
**Docs:** https://reacticx.com/docs/components/tilt-carousel

---

### lanyard
**Name:** Unstable Lanyard  
**Description:** Draggable card attached to a flexible rope that swings naturally under gravity.  
**CLI key:** `lanyard`  
**Dependencies:** `react-native-reanimated`, `@shopify/react-native-skia`, `react-native-gesture-handler`, `react-native-worklets`, `expo-haptics`  
**Docs:** https://reacticx.com/docs/components/lanyard

---

### vertical-flow-carousel
**Name:** Vertical Flow Carousel  
**Description:** Vertical snapping carousel.  
**CLI key:** `vertical-flow-carousel`  
**Dependencies:** `react-native-reanimated`, `expo-blur`  
**Docs:** https://reacticx.com/docs/components/vertical-flow-carousel

---

### vertical-page-carousel
**Name:** Vertical Page Carousel  
**Description:** Vertically paged carousel with snap scrolling.  
**CLI key:** `vertical-page-carousel`  
**Dependencies:** `react-native-reanimated`, `sbaiahmed1/react-native-blur`, `react-native-worklets`, `expo-haptics`  
**Docs:** https://reacticx.com/docs/components/vertical-page-carousel

---

## Organisms (25 components)

### animated-header-scrollview
**Name:** Animated Header ScrollView  
**Description:** iOS-styled animated large-to-small header on scroll.  
**CLI key:** `animated-header-scrollview`  
**Dependencies:** `react-native-reanimated`, `react-native-safe-area-context`, `react-native-easing-gradient`, `@react-native-masked-view/masked-view`, `expo-linear-gradient`, `expo-blur`  
**Docs:** https://reacticx.com/docs/components/animated-header-scrollview

---

### animated-text
**Name:** Animated Text  
**Description:** Staggered text animation that animates each character individually.  
**CLI key:** `animated-text`  
**Dependencies:** `react-native-reanimated`, `expo-blur`  
**Docs:** https://reacticx.com/docs/components/animated-text

---

### apple-intelligence
**Name:** Apple Intelligence  
**Description:** Apple Intelligence–style animated overlay provider.  
**CLI key:** `apple-intelligence`  
**Dependencies:** `react-native-reanimated`, `@shopify/react-native-skia`, `react-native-worklets`  
**Docs:** https://reacticx.com/docs/components/apple-intelligence

---

### check-box
**Name:** CheckBox  
**Description:** Animated checkbox that draws the checkmark smoothly when toggled.  
**CLI key:** `check-box`  
**Dependencies:** `react-native-reanimated`, `react-native-svg`  
**Docs:** https://reacticx.com/docs/components/check-box

---

### chroma-ring
**Name:** Chroma Ring  
**Description:** Animated chroma ring border with flowing glow effect.  
**CLI key:** `chroma-ring`  
**Dependencies:** `react-native-reanimated`, `@shopify/react-native-skia`  
**Docs:** https://reacticx.com/docs/components/chroma-ring

---

### circular-text
**Name:** Circular Text  
**Description:** Animated circular text that continuously rotates around a center point.  
**CLI key:** `circular-text`  
**Dependencies:** `react-native-reanimated`  
**Docs:** https://reacticx.com/docs/components/circular-text

---

### curved-marquee
**Name:** Curved Marquee  
**Description:** Animated marquee that scrolls text smoothly along a curved SVG path.  
**CLI key:** `curved-marquee`  
**Dependencies:** `react-native-reanimated`, `react-native-svg`  
**Docs:** https://reacticx.com/docs/components/curved-marquee

---

### dialog
**Name:** Dialog  
**Description:** Animated modal component with a blurred backdrop.  
**CLI key:** `dialog`  
**Dependencies:** `react-native-reanimated`, `react-native-worklets`, `expo-blur`  
**Docs:** https://reacticx.com/docs/components/dialog

---

### dropdown
**Name:** Dropdown  
**Description:** Animated dropdown menu that opens near its trigger with auto-positioning.  
**CLI key:** `dropdown`  
**Dependencies:** `react-native-reanimated`, `react-native-worklets`, `react-native-gesture-handler`, `expo-haptics`  
**Docs:** https://reacticx.com/docs/components/dropdown

---

### energy-orb
**Name:** Energy Orb  
**Description:** Energy ORB made using Skia's shader API.  
**CLI key:** `energy-orb`  
**Dependencies:** `react-native-reanimated`, `@shopify/react-native-skia`  
**Docs:** https://reacticx.com/docs/components/energy-orb

---

### fade-text
**Name:** Fade Text  
**Description:** Word-by-word fade-in text animation with smooth blur.  
**CLI key:** `fade-text`  
**Dependencies:** `react-native-reanimated`, `expo-blur`  
**Docs:** https://reacticx.com/docs/components/fade-text

---

### grainy-gradient
**Name:** Grainy Gradient  
**Description:** Skia-powered animated gradient with a subtle grain texture overlay.  
**CLI key:** `grainy-gradient`  
**Dependencies:** `react-native-reanimated`, `@shopify/react-native-skia`  
**Docs:** https://reacticx.com/docs/components/grainy-gradient

---

### infinite-menu
**Name:** Infinite Menu  
**Description:** Global, infinite radial menu built with Reanimated, Skia, and Gesture Handler.  
**CLI key:** `infinite-menu`  
**Dependencies:** `react-native-reanimated`, `@shopify/react-native-skia`, `react-native-gesture-handler`  
**Docs:** https://reacticx.com/docs/components/infinite-menu

---

### liquid-metal
**Name:** Liquid Metal  
**Description:** Animated liquid-metal surface shader with configurability.  
**CLI key:** `liquid-metal`  
**Dependencies:** `react-native-reanimated`, `@shopify/react-native-skia`  
**Docs:** https://reacticx.com/docs/components/liquid-metal

---

### matched-geometry
**Name:** Matched Geometry  
**Description:** Tap-to-expand matched geometry transition (hero animation).  
**CLI key:** `matched-geometry`  
**Dependencies:** `react-native-reanimated`, `react-native-worklets`, `expo-blur`, `react-native-gesture-handler`  
**Docs:** https://reacticx.com/docs/components/matched-geometry

---

### mesh-gradient
**Name:** Mesh Gradient  
**Description:** Skia-driven animated mesh gradient that smoothly blends up to four colors.  
**CLI key:** `mesh-gradient`  
**Dependencies:** `react-native-reanimated`, `@shopify/react-native-skia`  
**Docs:** https://reacticx.com/docs/components/mesh-gradient

---

### picker
**Name:** Picker  
**Description:** iOS-inspired picker component with drag and snap.  
**CLI key:** `picker`  
**Dependencies:** `react-native-reanimated`, `react-native-worklets`, `expo-blur`, `react-native-gesture-handler`, `expo-haptics`, `expo-linear-gradient`  
**Docs:** https://reacticx.com/docs/components/picker

---

### progress
**Name:** Progress  
**Description:** Animated progress bar that smoothly fills with optional gradient.  
**CLI key:** `progress`  
**Dependencies:** `react-native-reanimated`, `expo-linear-gradient`  
**Docs:** https://reacticx.com/docs/components/progress

---

### radial-intro
**Name:** Radial Intro  
**Description:** Animated radial intro screen effect inspired by react-bits.  
**CLI key:** `radial-intro`  
**Dependencies:** `react-native-reanimated`, `expo-blur`  
**Docs:** https://reacticx.com/docs/components/radial-intro

---

### rolling-counter
**Name:** Rolling Counter  
**Description:** Animated rolling counter where each digit slides vertically with spring motion.  
**CLI key:** `rolling-counter`  
**Dependencies:** `react-native-reanimated`, `react-native-worklets`, `expo-blur`  
**Docs:** https://reacticx.com/docs/components/rolling-counter

---

### segmented-control
**Name:** Segmented Control  
**Description:** Gesture-driven segmented control with a sliding active indicator.  
**CLI key:** `segmented-control`  
**Dependencies:** `react-native-reanimated`, `react-native-worklets`, `expo-blur`, `react-native-gesture-handler`  
**Docs:** https://reacticx.com/docs/components/segmented-control

---

### skia-ripple
**Name:** Skia Ripple  
**Description:** Tap-driven Skia ripple effect.  
**CLI key:** `skia-ripple`  
**Dependencies:** `react-native-reanimated`, `@shopify/react-native-skia`, `react-native-gesture-handler`  
**Docs:** https://reacticx.com/docs/components/skia-ripple

---

### staggered-text
**Name:** Staggered Text  
**Description:** Smooth staggered text animation built using Skia.  
**CLI key:** `staggered-text`  
**Dependencies:** `react-native-reanimated`, `@shopify/react-native-skia`  
**Docs:** https://reacticx.com/docs/components/staggered-text

---

### theme-switch
**Name:** Theme Switch  
**Description:** Skia-based theme switch interaction with smooth transition.  
**CLI key:** `theme-switch`  
**Dependencies:** `react-native-reanimated`, `@shopify/react-native-skia`  
**Docs:** https://reacticx.com/docs/components/theme-switch

---

### wave-scrawler
**Name:** Wave Scrawler  
**Description:** Wave scrawler built with Skia's shader.  
**CLI key:** `wave-scrawler`  
**Dependencies:** `react-native-reanimated`, `@shopify/react-native-skia`  
**Docs:** https://reacticx.com/docs/components/wave-scrawler

---

## Templates (3 components)

### bottom-sheet
**Name:** Bottom Sheet  
**Description:** Customizable bottom sheet with smooth snap points, drag gestures, scroll-aware behavior, dynamic heights, backdrop dismissal, and nested scrolling.  
**CLI key:** `bottom-sheet`  
**Dependencies:** `react-native-reanimated`, `react-native-worklets`, `react-native-gesture-handler`  
**Docs:** https://reacticx.com/docs/components/bottom-sheet

---

### bottom-sheet-stack
**Name:** Bottom Sheet Stack  
**Description:** Stack-based bottom sheet manager for layering multiple sheets with depth scaling.  
**CLI key:** `bottom-sheet-stack`  
**Dependencies:** `react-native-reanimated`  
**Docs:** https://reacticx.com/docs/components/bottom-sheet-stack

---

### parallax-header
**Name:** Parallax Header  
**Description:** Scroll-driven parallax header component.  
**CLI key:** `parallax-header`  
**Dependencies:** `expo-blur`, `expo-linear-gradient`  
**Docs:** https://reacticx.com/docs/components/parallax-header

---

## Other (11 components)

### animated-chip-group
**Name:** Animated Chip Group  
**Description:** Animated chip selector where items expand on selection.  
**CLI key:** `animated-chip-group`  
**Dependencies:** `react-native-reanimated`  
**Docs:** https://reacticx.com/docs/components/animated-chip-group

---

### progress-circular
**Name:** Circular Progress  
**Description:** Circular progress ring that animates smoothly around a center button or icon.  
**CLI key:** `progress-circular`  
**Dependencies:** `react-native-reanimated`, `react-native-svg`  
**Docs:** https://reacticx.com/docs/components/progress-circular

---

### morphing-tab-bar
**Name:** Morphing Tab Bar  
**Description:** Tab bar where tabs transition fluidly as selection changes.  
**CLI key:** `morphing-tab-bar`  
**Dependencies:** `react-native-reanimated`, `@shopify/react-native-skia`, `expo-haptics`  
**Docs:** https://reacticx.com/docs/components/morphing-tab-bar

---

### pagination
**Name:** Pagination  
**Description:** Draggable pagination indicator for carousels.  
**CLI key:** `pagination`  
**Dependencies:** `react-native-reanimated`, `react-native-worklets`, `expo-haptics`, `react-native-gesture-handler`  
**Docs:** https://reacticx.com/docs/components/pagination

---

### seekbar
**Name:** Seekbar  
**Description:** Interactive seek bar with drag and tap control.  
**CLI key:** `seekbar`  
**Dependencies:** `react-native-reanimated`, `react-native-gesture-handler`, `expo-haptics`, `react-native-worklets`  
**Docs:** https://reacticx.com/docs/components/seekbar

---

### shimmer
**Name:** Shimmer  
**Description:** Loading placeholder with animated shimmer or pulse effect.  
**CLI key:** `shimmer`  
**Dependencies:** `react-native-reanimated`, `react-native-gesture-handler`, `expo-haptics`, `react-native-worklets`  
**Docs:** https://reacticx.com/docs/components/shimmer

---

### shimmer-wave
**Name:** Shimmer Wave Text  
**Description:** Text component with smooth shimmer wave animation.  
**CLI key:** `shimmer-wave`  
**Dependencies:** `react-native-reanimated`, `react-native-worklets`, `expo-linear-gradient`  
**Docs:** https://reacticx.com/docs/components/shimmer-wave

---

### siri-orb
**Name:** Siri Orb  
**Description:** Siri-inspired orb built with Skia's shader.  
**CLI key:** `siri-orb`  
**Dependencies:** `react-native-reanimated`, `@shopify/react-native-skia`  
**Docs:** https://reacticx.com/docs/components/siri-orb

---

### stack-cards
**Name:** Stack Cards  
**Description:** Stacked cards layout navigated with vertical fling gestures.  
**CLI key:** `stack-cards`  
**Dependencies:** `react-native-reanimated`, `react-native-gesture-handler`, `expo-blur`  
**Docs:** https://reacticx.com/docs/components/stack-cards

---

### switch
**Name:** Switch  
**Description:** Animated toggle switch with spring motion.  
**CLI key:** `switch`  
**Dependencies:** `react-native-reanimated`  
**Docs:** https://reacticx.com/docs/components/switch

---

### toast
**Name:** Toast  
**Description:** Fully featured toast system with a global API and stacked animations.  
**CLI key:** `toast`  
**Dependencies:** `react-native-reanimated`, `react-native-worklets`, `react-native-safe-area-context`  
**Docs:** https://reacticx.com/docs/components/toast

---
