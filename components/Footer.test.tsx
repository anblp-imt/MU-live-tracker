import { describe, it, expect, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Footer } from './Footer';

afterEach(() => {
  delete process.env.COPYRIGHT_NAME;
  delete process.env.SOCIAL_FACEBOOK_URL;
  delete process.env.SOCIAL_LINKEDIN_URL;
  delete process.env.SOCIAL_TIKTOK_URL;
});

describe('Footer', () => {
  it('renders the copyright name and current year when set', () => {
    process.env.COPYRIGHT_NAME = 'An Bui';
    render(<Footer />);
    expect(screen.getByText(`© ${new Date().getFullYear()} An Bui. All rights reserved.`)).toBeInTheDocument();
  });

  it('omits the name when COPYRIGHT_NAME is unset', () => {
    render(<Footer />);
    expect(screen.getByText(`© ${new Date().getFullYear()}. All rights reserved.`)).toBeInTheDocument();
  });

  it('renders only the social links whose env var is set', () => {
    process.env.SOCIAL_FACEBOOK_URL = 'https://facebook.com/example';
    process.env.SOCIAL_TIKTOK_URL = 'https://tiktok.com/@example';
    render(<Footer />);

    expect(screen.getByRole('link', { name: 'Facebook' })).toHaveAttribute('href', 'https://facebook.com/example');
    expect(screen.getByRole('link', { name: 'TikTok' })).toHaveAttribute('href', 'https://tiktok.com/@example');
    expect(screen.queryByRole('link', { name: 'LinkedIn' })).not.toBeInTheDocument();
  });

  it('renders no social links when none are set', () => {
    render(<Footer />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
