import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { About } from './About'

vi.mock('../lib/api', () => ({
  GetAppVersion: vi.fn().mockResolvedValue('2.6.0'),
}))

describe('About', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders About page', () => {
    render(<About />)
    expect(screen.getByText('YouFLAC')).toBeInTheDocument()
  })

  it('toggles FAQ item on click', () => {
    render(<About />)
    const question = screen.getByText('What is YouFLAC?')
    expect(screen.queryByText(/downloads YouTube videos/i)).not.toBeInTheDocument()
    fireEvent.click(question)
    expect(screen.getByText(/downloads YouTube videos/i)).toBeInTheDocument()
  })

  it('GitHub warning modal shown on GitHub button click', () => {
    render(<About />)
    const githubBtn = screen.getByRole('button', { name: /github/i })
    fireEvent.click(githubBtn)
    expect(screen.getByText('Before opening an issue')).toBeInTheDocument()
  })

  it('dismisses GitHub modal on Cancel', () => {
    render(<About />)
    const githubBtn = screen.getByRole('button', { name: /github/i })
    fireEvent.click(githubBtn)
    expect(screen.getByText('Before opening an issue')).toBeInTheDocument()
    const cancelBtn = screen.getByRole('button', { name: /cancel/i })
    fireEvent.click(cancelBtn)
    expect(screen.queryByText('Before opening an issue')).not.toBeInTheDocument()
  })
})
