import React from 'react'
import {MockedProvider} from '@apollo/client/testing'
import {AuthorEditPanel} from '../../src/client/panel/authorEditPanel'
import {CreateAuthorDocument, AuthorDocument} from '../../src/client/api'
import Enzyme, {mount} from 'enzyme'
import Adapter from 'enzyme-adapter-react-16'

// React 16 Enzyme adapter
Enzyme.configure({adapter: new Adapter()})

import {UIProvider} from '@karma.run/ui'
import {act} from 'react-dom/test-utils'
import {updateWrapper} from '../utils'
import * as fela from 'fela'
//import wait from 'waait'

const styleRenderer: fela.IRenderer = {
  renderRule: jest.fn(),
  renderKeyframe: jest.fn(),
  renderFont: jest.fn(),
  renderStatic: jest.fn(),
  renderToString: jest.fn(),
  subscribe: jest.fn(),
  clear: jest.fn()
}

test('Author Edit Panel should render', () => {
  const wrapper = mount(
    <UIProvider styleRenderer={styleRenderer} rootElementID={'fskr'}>
      <MockedProvider addTypename={false}>
        <AuthorEditPanel />
      </MockedProvider>
    </UIProvider>
  )
  const panel = wrapper.find('AuthorEditPanel')
  expect(panel).toMatchSnapshot()
})

test('Author Edit Panel should render with id', async () => {
  const mocks = [
    {
      request: {
        query: AuthorDocument,
        variables: {
          id: 'fakeId2'
        }
      },
      result: () => ({
        data: {
          author: {
            __typename: 'Author',
            id: 'fakeId2',
            name: 'Douglas Cole'
          }
        }
      })
    }
  ]

  const wrapper = mount(
    <UIProvider styleRenderer={styleRenderer} rootElementID={'fskr'}>
      <MockedProvider mocks={mocks} addTypename={true}>
        <AuthorEditPanel id={'fakeId2'} />
      </MockedProvider>
    </UIProvider>
  )

  await updateWrapper(wrapper, 100)
  const panel = wrapper.find('AuthorEditPanel')
  expect(panel).toMatchSnapshot()
})

test('Clicking add block button should display two text fields ', async () => {
  const wrapper = mount(
    <UIProvider styleRenderer={styleRenderer} rootElementID={'fskr'}>
      <MockedProvider addTypename={false}>
        <AuthorEditPanel />
      </MockedProvider>
    </UIProvider>
  )
  await updateWrapper(wrapper, 100)

  const button = wrapper.find('button[title="Add Block"]')
  button.simulate('click')

  const inputField = wrapper.find('input[placeholder="authors.panels.title"]')
  inputField.props().value = 'abcd'

  const panel = wrapper.find('AuthorEditPanel')
  expect(panel).toMatchSnapshot()
})

test('User should be able to create a new author', async () => {
  const author = {
    name: 'Lois Lane',
    id: 'fakeId3',
    slug: 'clark-kent',
    url: 'url',
    links: []
  }
  const mocks = [
    {
      request: {
        query: CreateAuthorDocument,
        variables: {
          input: {
            name: 'Clark Kent',
            slug: author.slug,
            links: [],
            bio: []
          }
        }
      },
      result: () => ({
        data: {
          author: {
            __typename: 'Author',
            id: author.id,
            name: author.name,
            //createdAt: '2019-12-03T10:15:30Z',
            //modifiedAt: '2019-12-03T10:15:30Z',
            slug: author.slug,
            url: author.url
          }
        }
      })
    }
  ]
  let wrapper = mount(
    <UIProvider styleRenderer={styleRenderer} rootElementID={'fskr'}>
      <MockedProvider mocks={mocks} addTypename={false}>
        <AuthorEditPanel />
      </MockedProvider>
    </UIProvider>
  )

  await act(async () => {
    wrapper
      .find('input[placeholder="authors.panels.name"]')
      .simulate('change', {target: {value: author.name}})
  })

  act(() => {
    wrapper.find('ForwardRef(NavigationButton)[label="authors.panels.create"]').simulate('click')
  })

  const panel = wrapper.find('AuthorEditPanel')
  expect(panel).toMatchSnapshot()
})