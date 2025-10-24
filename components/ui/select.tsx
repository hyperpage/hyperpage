// This Select component is not used in the current app
// Stub components to maintain exports without Radix UI dependencies
"use client"

import * as React from "react"

function Select(props: Record<string, unknown>) {
  return <div {...props}>Select stub - not implemented</div>
}

function SelectGroup(props: Record<string, unknown>) {
  return <div {...props} />
}

function SelectValue(props: Record<string, unknown>) {
  return <div {...props} />
}

function SelectTrigger({ children, ...props }: Record<string, unknown> & { children?: React.ReactNode }) {
  return <div {...props}>{children}</div>
}

function SelectContent({ children, ...props }: Record<string, unknown> & { children?: React.ReactNode }) {
  return <div {...props}>{children}</div>
}

function SelectItem({ children, ...props }: Record<string, unknown> & { children?: React.ReactNode }) {
  return <div {...props}>{children}</div>
}

function SelectLabel(props: Record<string, unknown>) {
  return <div {...props} />
}

function SelectSeparator(props: Record<string, unknown>) {
  return <div {...props} />
}

function SelectScrollUpButton(props: Record<string, unknown>) {
  return <div {...props}>↑</div>
}

function SelectScrollDownButton(props: Record<string, unknown>) {
  return <div {...props}>↓</div>
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}
