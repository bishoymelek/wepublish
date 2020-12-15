import React, {useState, memo, useEffect, useMemo} from 'react'
import {
  Editor,
  Node as SlateNode,
  Element as SlateElement,
  createEditor,
  Range,
  Transforms,
  Point
} from 'slate'

import {
  useSlate,
  Editable,
  RenderElementProps,
  Slate,
  withReact,
  RenderLeafProps,
  ReactEditor
} from 'slate-react'

import {withHistory} from 'slate-history'
import {jsx} from 'slate-hyperscript'

import {BlockProps} from '../../atoms/blockList'
import {
  Toolbar,
  ToolbarIconButtonProps,
  ToolbarIconButton,
  ToolbarDivider,
  ToolbarButton,
  ToolbarButtonProps,
  SubMenuButton
} from '../../atoms/toolbar'
import {EmojiPicker} from '../../atoms/emojiPicker'
import {TableMenu} from './tableMenu'

import {RichTextBlockValue} from '../types'

import {useTranslation} from 'react-i18next'
import {Button, ControlLabel, Form, FormControl, FormGroup, Modal} from 'rsuite'

import {BlockFormat, InlineFormat, TextFormat, Format, InlineFormats} from './formats'

import {isFormatActive, toggleFormat} from './editorUtils'

const ElementTags: any = {
  A: (el: Element) => ({
    type: InlineFormat.Link,
    url: el.getAttribute('data-href') || el.getAttribute('href'),
    title: el.getAttribute('data-title') || el.getAttribute('title')
  }),
  H1: () => ({type: BlockFormat.H1}),
  H2: () => ({type: BlockFormat.H2}),
  H3: () => ({type: BlockFormat.H3}),
  P: () => ({type: BlockFormat.Paragraph}),
  LI: () => ({type: BlockFormat.ListItem}),
  OL: () => ({type: BlockFormat.OrderedList}),
  UL: () => ({type: BlockFormat.UnorderedList}),
  TB: () => ({type: BlockFormat.Table}),
  TR: () => ({type: BlockFormat.TableRow}),
  TD: (el: Element) => ({
    type: BlockFormat.TableCell,
    borderColor: el.getAttribute('borderColor')
  })
}

const TextTags: any = {
  S: () => ({[TextFormat.Strikethrough]: true}),
  DEL: () => ({[TextFormat.Strikethrough]: true}),
  EM: () => ({[TextFormat.Italic]: true}),
  I: () => ({[TextFormat.Italic]: true}),
  STRONG: () => ({[TextFormat.Bold]: true}),
  B: () => ({[TextFormat.Bold]: true}),
  U: () => ({[TextFormat.Underline]: true}),
  SUP: () => ({[TextFormat.Superscript]: true}),
  SUB: () => ({[TextFormat.Subscript]: true})
}

function deserialize(element: Element): any {
  const {nodeName, nodeType} = element

  if (nodeType === Node.TEXT_NODE) {
    return element.textContent
  } else if (nodeType !== Node.ELEMENT_NODE) {
    return null
  } else if (nodeName === 'BR') {
    return '\n'
  }

  let parent: Element = element

  if (nodeName === 'PRE' && element.childNodes[0] && element.childNodes[0].nodeName === 'CODE') {
    parent = element.childNodes[0] as Element
  }

  const children = Array.from(parent.childNodes)
    .map(element => deserialize(element as Element))
    .flat()

  if (nodeName === 'BODY') {
    return jsx('fragment', {}, children)
  }

  if (ElementTags[nodeName]) {
    const attrs = ElementTags[nodeName](element)
    return jsx('element', attrs, children)
  }

  if (TextTags[nodeName]) {
    const attrs = TextTags[nodeName](element)

    if (!children.some(child => child.children !== undefined)) {
      return children.map(child => {
        return jsx('text', attrs, child)
      })
    }
  }

  return children
}

function renderElement({attributes, children, element}: RenderElementProps) {
  switch (element.type) {
    case BlockFormat.H1:
      return <h1 {...attributes}>{children}</h1>

    case BlockFormat.H2:
      return <h2 {...attributes}>{children}</h2>

    case BlockFormat.H3:
      return <h3 {...attributes}>{children}</h3>

    case BlockFormat.UnorderedList:
      return <ul {...attributes}>{children}</ul>

    case BlockFormat.OrderedList:
      return <ol {...attributes}>{children}</ol>

    case BlockFormat.ListItem:
      return <li {...attributes}>{children}</li>

    case BlockFormat.Table:
      return (
        <table>
          <tbody {...attributes}>{children}</tbody>
        </table>
      )

    case BlockFormat.TableRow:
      return <tr {...attributes}>{children}</tr>

    case BlockFormat.TableCell:
      // TODO custom borderColor using colorPicker
      return (
        <td
          {...attributes}
          style={{
            borderColor:
              element.borderColor === 'transparent'
                ? `rgb(0, 0, 0, 0.1)`
                : (element.borderColor as string)
          }}>
          {children}
        </td>
      )

    case InlineFormat.Link:
      // TODO: Implement custom tooltip
      // const title = element.title ? `${element.title}: ${element.url}` : element.url
      // title={title}

      return (
        <a data-title={element.title} data-href={element.url} {...attributes}>
          {children}
        </a>
      )

    default:
      return <p {...attributes}>{children}</p>
  }
}

function renderLeaf({attributes, children, leaf}: RenderLeafProps) {
  if (leaf[TextFormat.Bold]) {
    children = <strong {...attributes}>{children}</strong>
  }

  if (leaf[TextFormat.Italic]) {
    children = <em {...attributes}>{children}</em>
  }

  if (leaf[TextFormat.Underline]) {
    children = <u {...attributes}>{children}</u>
  }

  if (leaf[TextFormat.Strikethrough]) {
    children = <del {...attributes}>{children}</del>
  }

  if (leaf[TextFormat.Superscript]) {
    children = <sup {...attributes}>{children}</sup>
  }

  if (leaf[TextFormat.Subscript]) {
    children = <sub {...attributes}>{children}</sub>
  }

  return <span {...attributes}>{children}</span>
}

// TODO: Re-implement via `normalizeNode`
// See: https://github.com/ianstormtaylor/slate/blob/master/Changelog.md#0530--december-10-2019

// const withSchema = defineSchema([
//   {
//     for: 'node',
//     match: 'editor',
//     validate: {
//       children: [
//         {
//           match: [
//             ([node]) =>
//               node.type === BlockFormat.H1 ||
//               node.type === BlockFormat.H2 ||
//               node.type === BlockFormat.H3 ||
//               node.type === BlockFormat.UnorderedList ||
//               node.type === BlockFormat.OrderedList ||
//               node.type === BlockFormat.Paragraph ||
//               node.type === InlineFormat.Link
//           ]
//         }
//       ]
//     },
//     normalize: (editor, error) => {
//       const {code, path} = error

//       switch (code) {
//         case 'child_invalid':
//           Editor.setNodes(editor, {type: BlockFormat.Paragraph}, {at: path})
//           break
//       }
//     }
//   },

//   {
//     for: 'node',
//     match: ([node]) =>
//       node.type === BlockFormat.UnorderedList || node.type === BlockFormat.OrderedList,
//     validate: {
//       children: [{match: [([node]) => node.type === BlockFormat.ListItem]}]
//     },
//     normalize: (editor, error) => {
//       const {code, path} = error

//       switch (code) {
//         case 'child_invalid':
//           Editor.setNodes(editor, {type: BlockFormat.ListItem}, {at: path})
//           break
//       }
//     }
//   }
// ])

export type RichTextBlockProps = BlockProps<RichTextBlockValue>

export const RichTextBlock = memo(function RichTextBlock({
  value,
  autofocus,
  disabled,
  onChange
}: RichTextBlockProps) {
  const editor = useMemo(() => withRichText(withHistory(withReact(createEditor()))), [])
  const [hasFocus, setFocus] = useState(false)

  const {t} = useTranslation()

  useEffect(() => {
    if (autofocus) {
      ReactEditor.focus(editor)
    }
  }, [])

  return (
    <Slate
      editor={editor}
      value={value}
      onChange={(newValue: SlateNode[]) => {
        setFocus(ReactEditor.isFocused(editor))
        if (value !== newValue) onChange(newValue)
      }}>
      <Toolbar fadeOut={!hasFocus}>
        <FormatButtonWithChildren format={BlockFormat.H1}>
          <H1Icon />
        </FormatButtonWithChildren>
        <FormatButtonWithChildren format={BlockFormat.H2}>
          <H2Icon />
        </FormatButtonWithChildren>
        <FormatButtonWithChildren format={BlockFormat.H3}>
          <H3Icon />
        </FormatButtonWithChildren>

        <ToolbarDivider />

        <FormatButton icon="list-ul" format={BlockFormat.UnorderedList} />
        <FormatButton icon="list-ol" format={BlockFormat.OrderedList} />

        <ToolbarDivider />

        <SubMenuButton icon="table">
          <TableMenu />
        </SubMenuButton>

        <ToolbarDivider />

        <FormatButton icon="bold" format={TextFormat.Bold} />
        <FormatButton icon="italic" format={TextFormat.Italic} />
        <FormatButton icon="underline" format={TextFormat.Underline} />
        <FormatButton icon="strikethrough" format={TextFormat.Strikethrough} />
        <FormatButton icon="superscript" format={TextFormat.Superscript} />
        <FormatButton icon="subscript" format={TextFormat.Subscript} />

        <ToolbarDivider />

        <LinkFormatButton />
        <RemoveLinkFormatButton />

        <ToolbarDivider />

        <SubMenuButton icon="smile-o">
          <EmojiPicker doWithEmoji={emoji => editor.insertText(emoji)} />
        </SubMenuButton>
      </Toolbar>
      <Editable
        readOnly={disabled}
        placeholder={t('blocks.richText.startWriting')}
        renderElement={renderElement}
        renderLeaf={renderLeaf}
      />
    </Slate>
  )
})

interface SlateBlockButtonProps extends ToolbarIconButtonProps {
  readonly format: Format
}

function FormatButton({icon, format}: SlateBlockButtonProps) {
  const editor = useSlate()

  return (
    <ToolbarIconButton
      icon={icon}
      active={isFormatActive(editor, format)}
      onMouseDown={e => {
        e.preventDefault()
        toggleFormat(editor, format)
      }}
    />
  )
}

interface SlateBlockButtonWithChildrenProps extends ToolbarButtonProps {
  readonly format: Format
}

function FormatButtonWithChildren({format, children}: SlateBlockButtonWithChildrenProps) {
  const editor = useSlate()

  return (
    <ToolbarButton
      active={isFormatActive(editor, format)}
      onMouseDown={e => {
        e.preventDefault()
        toggleFormat(editor, format)
      }}>
      {children}
    </ToolbarButton>
  )
}

function LinkFormatButton() {
  const editor = useSlate()
  const [isLinkDialogOpen, setLinkDialogOpen] = useState(false)
  const [selection, setSelection] = useState<Range | null>(null)

  const [title, setTitle] = useState('')
  const [url, setURL] = useState('')

  const validatedURL = validateURL(url)
  const isDisabled = !validatedURL

  const {t} = useTranslation()

  return (
    <>
      <ToolbarIconButton
        icon="link"
        active={isFormatActive(editor, InlineFormat.Link)}
        onMouseDown={e => {
          e.preventDefault()

          const nodes = Array.from(
            Editor.nodes(editor, {
              at: editor.selection ?? undefined,
              match: node => node.type === InlineFormat.Link
            })
          )

          const tuple = nodes[0]

          if (tuple) {
            const [node] = tuple

            setTitle((node.title as string) ?? '')
            setURL((node.url as string) ?? '')
          } else {
            setTitle('')
            setURL('')
          }

          setSelection(editor.selection)
          setLinkDialogOpen(true)
        }}
      />
      <Modal show={isLinkDialogOpen} size={'sm'} onHide={() => setLinkDialogOpen(false)}>
        <Modal.Body>
          <Form fluid={true}>
            <FormGroup>
              <ControlLabel>{t('blocks.richText.link')}</ControlLabel>
              <FormControl
                errorMessage={url && !validatedURL ? 'Invalid Link' : undefined}
                value={url}
                onChange={url => setURL(url)}
              />
            </FormGroup>
            <FormGroup>
              <ControlLabel>{t('blocks.richText.title')}</ControlLabel>
              <FormControl value={title} onChange={title => setTitle(title)} />
            </FormGroup>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button
            disabled={isDisabled}
            onClick={() => {
              insertLink(editor, selection, validatedURL!, title || undefined)
              setLinkDialogOpen(false)
            }}>
            {t('Apply')}
          </Button>
          <Button onClick={() => setLinkDialogOpen(false)}>{t('Cancel')}</Button>
        </Modal.Footer>
      </Modal>
    </>
  )
}

function validateURL(url: string): string | null {
  return url

  // TODO: Implement better URL validation with for support relative links.
  // try {
  //   return new URL(url).toString()
  // } catch (err) {
  //   try {
  //     return new URL(`https://${url}`).toString()
  //   } catch (err) {
  //     return null
  //   }
  // }
}

function RemoveLinkFormatButton() {
  const editor = useSlate()

  return (
    <ToolbarIconButton
      icon="unlink"
      active={isFormatActive(editor, InlineFormat.Link)}
      disabled={!isFormatActive(editor, InlineFormat.Link)}
      onMouseDown={e => {
        e.preventDefault()
        removeLink(editor)
      }}
    />
  )
}

function insertLink(editor: Editor, selection: Range | null, url: string, title?: string) {
  if (selection) {
    if (Range.isCollapsed(selection)) {
      const nodes = Array.from(
        Editor.nodes(editor, {
          at: selection,
          match: node => node.type === InlineFormat.Link
        })
      )

      const tuple = nodes[0]

      if (tuple) {
        const [, path] = tuple
        Transforms.select(editor, path)
      }
    } else {
      Transforms.select(editor, selection)
    }
  }

  Transforms.unwrapNodes(editor, {match: node => node.type === InlineFormat.Link})
  Transforms.wrapNodes(editor, {type: InlineFormat.Link, url, title, children: []}, {split: true})
  Transforms.collapse(editor, {edge: 'end'})
}

function removeLink(editor: Editor) {
  Transforms.unwrapNodes(editor, {match: node => node.type === InlineFormat.Link})
}

function withRichText<T extends ReactEditor>(editor: T): T {
  const {insertData, isInline, deleteForward, deleteBackward, deleteFragment} = editor
  // The delete commands are adjusted to avoid modifying the table structure directly. Some
  // unwanted  behaviour occurs when doing so.

  editor.isInline = node => (InlineFormats.includes(node.type as string) ? true : isInline(node))

  editor.insertData = (data: any) => {
    const html = data.getData('text/html')

    if (html) {
      const parsed = new DOMParser().parseFromString(html, 'text/html')
      const fragment = deserialize(parsed.body)
      Editor.insertFragment(editor, fragment)
    } else {
      insertData(data)
    }
  }

  const tablePreventDelete = (
    location: 'start' | 'end',
    check: 'rangeIncludes' | 'pointEquals'
  ): boolean => {
    const {selection} = editor

    if (selection) {
      const [cell] = Editor.nodes(editor, {
        match: n =>
          !Editor.isEditor(n) && SlateElement.isElement(n) && n.type === BlockFormat.TableCell
      })

      if (cell) {
        const [, cellPath] = cell
        const point = Editor[location](editor, cellPath)

        if (check === 'pointEquals') {
          return Point.equals(selection.anchor, point)
        } else if (check === 'rangeIncludes') {
          return Range.includes(selection, point)
        }
      }
    }
    return false
  }

  editor.deleteFragment = () => {
    if (tablePreventDelete('start', 'rangeIncludes')) {
      return
    }

    deleteFragment()
  }

  editor.deleteBackward = unit => {
    if (tablePreventDelete('start', 'pointEquals')) {
      return
    }

    deleteBackward(unit)
  }

  editor.deleteForward = unit => {
    if (tablePreventDelete('end', 'pointEquals')) {
      return
    }

    deleteForward(unit)
  }

  return editor
}

export function createDefaultValue(): RichTextBlockValue {
  return [{type: BlockFormat.Paragraph, children: [{text: ''}]}]
}

function H1Icon() {
  // from https://icons.getbootstrap.com/
  return (
    <svg
      width="1em"
      height="1em"
      viewBox="0 0 16 16"
      className="bi bi-type-h1"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg">
      <path d="M8.637 13V3.669H7.379V7.62H2.758V3.67H1.5V13h1.258V8.728h4.62V13h1.259zm5.329 0V3.669h-1.244L10.5 5.316v1.265l2.16-1.565h.062V13h1.244z" />
    </svg>
  )
}

function H2Icon() {
  // from https://icons.getbootstrap.com/
  return (
    <svg
      width="1em"
      height="1em"
      viewBox="0 0 16 16"
      className="bi bi-type-h2"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg">
      <path d="M7.638 13V3.669H6.38V7.62H1.759V3.67H.5V13h1.258V8.728h4.62V13h1.259zm3.022-6.733v-.048c0-.889.63-1.668 1.716-1.668.957 0 1.675.608 1.675 1.572 0 .855-.554 1.504-1.067 2.085l-3.513 3.999V13H15.5v-1.094h-4.245v-.075l2.481-2.844c.875-.998 1.586-1.784 1.586-2.953 0-1.463-1.155-2.556-2.919-2.556-1.941 0-2.966 1.326-2.966 2.74v.049h1.223z" />
    </svg>
  )
}

function H3Icon() {
  // from https://icons.getbootstrap.com/
  return (
    <svg
      width="1em"
      height="1em"
      viewBox="0 0 16 16"
      className="bi bi-type-h3"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg">
      <path d="M7.637 13V3.669H6.379V7.62H1.758V3.67H.5V13h1.258V8.728h4.62V13h1.259zm3.625-4.272h1.018c1.142 0 1.935.67 1.949 1.674.013 1.005-.78 1.737-2.01 1.73-1.08-.007-1.853-.588-1.935-1.32H9.108c.069 1.327 1.224 2.386 3.083 2.386 1.935 0 3.343-1.155 3.309-2.789-.027-1.51-1.251-2.16-2.037-2.249v-.068c.704-.123 1.764-.91 1.723-2.229-.035-1.353-1.176-2.4-2.954-2.385-1.873.006-2.857 1.162-2.898 2.358h1.196c.062-.69.711-1.299 1.696-1.299.998 0 1.695.622 1.695 1.525.007.922-.718 1.592-1.695 1.592h-.964v1.074z" />
    </svg>
  )
}
