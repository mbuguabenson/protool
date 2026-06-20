# UI DESIGN GUIDE: DIGIT CARDS, TYPOGRAPHY & COLOR SYSTEM

This document serves as the color and branding guidelines for the **AnalysisProfitHub** platform. It outlines the typography system, color palette, digit cards design, and interactive states using Tailwind CSS configurations.

## COLOR PALETTE (3-5 Colors Maximum)

### Primary Brand Colors

- **Primary**: `#0066FF` (Blue) - Main actions, highlights
- **Secondary**: `#00D4AA` (Teal) - Success, active states
- **Neutral Dark**: `#1A1A1A` (Near-black) - Text, dark backgrounds
- **Neutral Light**: `#F5F5F5` (Off-white) - Light backgrounds
- **Accent**: `#FF6B35` (Orange) - Warnings, alerts

### Tailwind CSS Color Mapping

```css
/* globals.css */
@theme {
    --color-primary: #0066ff;
    --color-secondary: #00d4aa;
    --color-dark: #1a1a1a;
    --color-light: #f5f5f5;
    --color-accent: #ff6b35;

    --color-success: #00d4aa;
    --color-warning: #ff6b35;
    --color-error: #ff4757;
    --color-info: #0066ff;
}
```

---

## TYPOGRAPHY SYSTEM (2 Font Families Maximum)

### Font Stack

- **Headings**: `Inter` (Bold, Semibold) - Modern, clean
- **Body**: `Inter` (Regular, Medium) - Professional, readable

### Font Scale

```plaintext
Display: 48px / 56px (font-bold)
H1: 36px / 44px (font-bold)
H2: 28px / 36px (font-semibold)
H3: 20px / 28px (font-semibold)
Body-lg: 18px / 28px (font-regular)
Body: 16px / 24px (font-regular)
Body-sm: 14px / 20px (font-regular)
Label: 12px / 16px (font-medium)
```

### Tailwind Implementation

```typescriptreact
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html className={`${inter.className} bg-light text-dark`}>
      <body>{children}</body>
    </html>
  )
}
```

---

## DIGIT CARDS DESIGN SYSTEM

### Card Component Specifications

#### Base Card Structure

```typescriptreact
<div className="bg-white rounded-lg border border-light shadow-sm p-6">
  {/* Card content */}
</div>
```

**CSS Properties:**

- Background: White (`bg-white`)
- Border: Light gray (`border-light` or `border-gray-200`)
- Border Radius: `rounded-lg` (8px)
- Padding: `p-6` (24px)
- Shadow: `shadow-sm` (subtle elevation)

### Digit Card Variants

#### 1. PRICE DISPLAY CARD

```typescriptreact
<div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
  {/* Header */}
  <div className="flex items-center justify-between mb-4">
    <span className="text-sm font-medium text-gray-600">EUR/USD</span>
    <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">+1.25%</span>
  </div>

  {/* Large digit display */}
  <div className="text-4xl font-bold text-dark mb-2">1.0832</div>

  {/* Smaller supporting digit */}
  <div className="text-sm text-gray-500">High: 1.0845 | Low: 1.0820</div>
</div>
```

**Key Classes:**

- Title: `text-sm font-medium text-gray-600`
- Main digit: `text-4xl font-bold text-dark`
- Badge: `bg-green-100 text-green-700 rounded`
- Support text: `text-sm text-gray-500`

#### 2. ANALYSIS CARD (Odd/Even, Over/Under)

```typescriptreact
<div className="bg-white rounded-lg border border-gray-200 p-6">
  {/* Card title */}
  <h3 className="text-lg font-semibold text-dark mb-4">Even/Odd Distribution</h3>

  {/* Two-column layout */}
  <div className="grid grid-cols-2 gap-4">
    {/* Even */}
    <div className="bg-blue-50 rounded p-4">
      <div className="text-xs font-medium text-gray-600 mb-2">EVEN</div>
      <div className="text-3xl font-bold text-primary">48%</div>
      <div className="text-xs text-gray-500 mt-1">120 occurrences</div>
    </div>

    {/* Odd */}
    <div className="bg-orange-50 rounded p-4">
      <div className="text-xs font-medium text-gray-600 mb-2">ODD</div>
      <div className="text-3xl font-bold text-accent">52%</div>
      <div className="text-xs text-gray-500 mt-1">130 occurrences</div>
    </div>
  </div>
</div>
```

**Key Classes:**

- Container: `grid grid-cols-2 gap-4`
- Stat box: `bg-blue-50 rounded p-4`
- Label: `text-xs font-medium text-gray-600`
- Big number: `text-3xl font-bold text-primary`
- Meta: `text-xs text-gray-500`

#### 3. TRADING SIGNAL CARD

```typescriptreact
<div className="bg-gradient-to-br from-primary to-blue-700 rounded-lg p-6 text-white">
  {/* Header */}
  <div className="flex items-start justify-between mb-4">
    <div>
      <h4 className="text-sm font-semibold">SIGNAL</h4>
      <p className="text-2xl font-bold mt-1">UP</p>
    </div>
    <span className="text-xs bg-white bg-opacity-20 px-3 py-1 rounded-full">85% Confidence</span>
  </div>

  {/* Details grid */}
  <div className="space-y-2 text-sm">
    <div className="flex justify-between">
      <span className="opacity-80">RSI</span>
      <span className="font-medium">72.5</span>
    </div>
    <div className="flex justify-between">
      <span className="opacity-80">MACD</span>
      <span className="font-medium">Bullish</span>
    </div>
  </div>
</div>
```

**Key Classes:**

- Gradient: `bg-gradient-to-br from-primary to-blue-700`
- Text color: `text-white`
- Badge: `bg-white bg-opacity-20 px-3 py-1 rounded-full`

#### 4. BALANCE/ACCOUNT CARD

```typescriptreact
<div className="bg-white rounded-lg border border-gray-200 p-6">
  {/* Section title */}
  <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
    Account Balance
  </div>

  {/* Large balance */}
  <div className="mb-6">
    <div className="text-4xl font-bold text-dark">$5,234.50</div>
    <div className="text-sm text-green-600 mt-1">+$234.50 today</div>
  </div>

  {/* Account info rows */}
  <div className="space-y-3 border-t border-gray-200 pt-4">
    <div className="flex justify-between items-center">
      <span className="text-sm text-gray-600">Equity</span>
      <span className="font-semibold text-dark">$5,234.50</span>
    </div>
    <div className="flex justify-between items-center">
      <span className="text-sm text-gray-600">Available</span>
      <span className="font-semibold text-dark">$5,000.00</span>
    </div>
  </div>
</div>
```

**Key Classes:**

- Section label: `text-xs font-medium text-gray-500 uppercase tracking-wide`
- Big value: `text-4xl font-bold text-dark`
- Change indicator: `text-sm text-green-600` (green for positive, red for negative)
- Row layout: `flex justify-between items-center`

---

## RESPONSIVE GRID LAYOUT

### Card Grid Container

```typescriptreact
<div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
  {/* Cards go here */}
</div>
```

**Breakpoints:**

- Mobile: `grid-cols-1` (1 card per row)
- Tablet: `md:grid-cols-2` (2 cards per row at 768px+)
- Desktop: `lg:grid-cols-3` (3 cards per row at 1024px+)

---

## INTERACTIVE STATES

### Hover Effects

```typescriptreact
<div className="bg-white rounded-lg border border-gray-200 p-6
             hover:shadow-lg hover:border-primary
             transition-all duration-200 cursor-pointer">
```

### Focus States (for clickable cards)

```typescriptreact
<div className="focus-visible:outline-none focus-visible:ring-2
             focus-visible:ring-primary focus-visible:ring-offset-2">
```

### Loading State

```typescriptreact
<div className="bg-white rounded-lg border border-gray-200 p-6 opacity-50 pointer-events-none">
  {/* Skeleton or spinner */}
</div>
```

---

## TAILWIND CSS UTILITIES QUICK REFERENCE

### Spacing Scale

- `p-4` = 16px padding
- `p-6` = 24px padding
- `gap-4` = 16px gap between items
- `gap-6` = 24px gap

### Typography

- `text-sm` = 14px
- `text-base` = 16px
- `text-lg` = 18px
- `text-xl` = 20px
- `text-2xl` = 24px
- `text-3xl` = 30px
- `text-4xl` = 36px
- `font-regular` = 400 weight
- `font-medium` = 500 weight
- `font-semibold` = 600 weight
- `font-bold` = 700 weight

### Borders & Radius

- `border` = 1px solid
- `rounded-lg` = 8px radius
- `rounded-xl` = 12px radius

### Colors

- Text: `text-dark`, `text-gray-600`, `text-green-700`
- Background: `bg-white`, `bg-light`, `bg-blue-50`
- Border: `border-gray-200`, `border-primary`

### Layout

- `flex items-center justify-between` - Horizontal spacing
- `grid grid-cols-2 gap-4` - 2-column grid
- `space-y-3` - Vertical spacing between children
- `flex-col` - Vertical stack

---

## DARK MODE SUPPORT (Optional)

```typescriptreact
<div className="bg-white dark:bg-gray-900
             text-dark dark:text-light
             border border-gray-200 dark:border-gray-700">
```

---

## COMPLETE EXAMPLE: MARKET DATA DASHBOARD

```typescriptreact
export default function MarketDashboard() {
  return (
    <main className="min-h-screen bg-light p-6">
      <div className="max-w-7xl mx-auto">
        {/* Page title */}
        <h1 className="text-3xl font-bold text-dark mb-8">Market Analysis</h1>

        {/* Cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Price Card */}
          <div className="bg-white rounded-lg border border-gray-200 p-6
                        hover:shadow-md transition-shadow">
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm font-medium text-gray-600">USD/EUR</span>
              <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">
                +2.3%
              </span>
            </div>
            <div className="text-4xl font-bold text-dark mb-2">1.0856</div>
            <div className="text-sm text-gray-500">High: 1.0890 | Low: 1.0810</div>
          </div>

          {/* Analysis Card */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-dark mb-4">Distribution</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 rounded p-4">
                <div className="text-xs font-medium text-gray-600 mb-2">UP</div>
                <div className="text-3xl font-bold text-primary">58%</div>
              </div>
              <div className="bg-orange-50 rounded p-4">
                <div className="text-xs font-medium text-gray-600 mb-2">DOWN</div>
                <div className="text-3xl font-bold text-accent">42%</div>
              </div>
            </div>
          </div>

          {/* Signal Card */}
          <div className="bg-gradient-to-br from-primary to-blue-700 rounded-lg p-6 text-white">
            <h4 className="text-sm font-semibold mb-2">AI SIGNAL</h4>
            <p className="text-3xl font-bold mb-4">BULLISH</p>
            <div className="text-sm space-y-2">
              <div className="flex justify-between">
                <span className="opacity-80">Confidence</span>
                <span className="font-medium">92%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
```
