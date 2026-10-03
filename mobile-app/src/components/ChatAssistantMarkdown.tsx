import React from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import Markdown, { MarkdownIt, renderRules, type RenderRules } from 'react-native-markdown-display'

const md = MarkdownIt({ typographer: true, breaks: true })

const rules: RenderRules = {
  ...renderRules,
  table: (node, children, parent, styles) => (
    <ScrollView
      key={node.key}
      horizontal
      nestedScrollEnabled
      showsHorizontalScrollIndicator
      style={{ maxWidth: '100%', marginVertical: 8 }}
      contentContainerStyle={{ flexGrow: 1, direction: 'rtl' }}
    >
      <View style={styles._VIEW_SAFE_table}>{children}</View>
    </ScrollView>
  ),
  tr: (node, children, parent, styles) => {
    let rowIdx = 0
    const parentNode = parent as { children?: { key: string }[] } | undefined
    if (parentNode?.children) {
      const i = parentNode.children.findIndex(c => c.key === node.key)
      if (i >= 0) rowIdx = i
    }
    const stripe = rowIdx % 2 === 1 ? { backgroundColor: '#f8fafc' } : undefined
    return (
      <View key={node.key} style={[styles._VIEW_SAFE_tr, stripe]}>
        {children}
      </View>
    )
  },
}

const markdownStyles = StyleSheet.create({
  body: {
    color: '#111827',
  },
  paragraph: {
    marginTop: 0,
    marginBottom: 8,
    flexWrap: 'wrap',
    flexDirection: 'row',
    width: '100%',
  },
  text: {
    fontSize: 15,
    lineHeight: 22,
    writingDirection: 'rtl',
  },
  strong: {
    fontWeight: '600',
  },
  em: {
    fontStyle: 'italic',
  },
  bullet_list: {
    marginBottom: 8,
  },
  ordered_list: {
    marginBottom: 8,
  },
  list_item: {
    marginBottom: 4,
    flexDirection: 'row',
  },
  link: {
    color: '#1d4ed8',
    textDecorationLine: 'underline',
  },
  code_inline: {
    backgroundColor: '#e5e7eb',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 14,
    borderWidth: 0,
    writingDirection: 'ltr',
  },
  code_block: {
    backgroundColor: '#1e293b',
    color: '#f1f5f9',
    padding: 12,
    borderRadius: 8,
    fontSize: 12,
    marginVertical: 8,
    writingDirection: 'ltr',
  },
  fence: {
    backgroundColor: '#1e293b',
    color: '#f1f5f9',
    padding: 12,
    borderRadius: 8,
    fontSize: 12,
    marginVertical: 8,
    writingDirection: 'ltr',
  },
  table: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    backgroundColor: '#ffffff',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    direction: 'rtl',
  },
  thead: {},
  tbody: {},
  tr: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
  },
  th: {
    flex: 1,
    minWidth: 72,
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: '#f1f5f9',
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
    borderBottomWidth: 2,
    borderBottomColor: '#cbd5e1',
    fontWeight: '600',
  },
  td: {
    flex: 1,
    minWidth: 72,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
    backgroundColor: 'transparent',
    fontSize: 13,
  },
  blockquote: {
    borderRightWidth: 3,
    borderRightColor: '#94a3b8',
    borderLeftWidth: 0,
    marginLeft: 0,
    paddingRight: 10,
    paddingHorizontal: 0,
    backgroundColor: 'transparent',
    marginVertical: 8,
  },
})

export function ChatAssistantMarkdown({ content }: { content: string }) {
  return (
    <View style={{ direction: 'rtl', alignSelf: 'stretch' }}>
      <Markdown markdownit={md} rules={rules} style={markdownStyles} mergeStyle>
        {content}
      </Markdown>
    </View>
  )
}
