import { Theme } from '@mui/material/styles';

// Breakpoints (in pixels)
export const breakpoints = {
  xs: 0,
  sm: 600,
  md: 960,
  lg: 1280,
  xl: 1920,
};

// Media queries
export const mediaQueries = {
  up: (key: keyof typeof breakpoints) => `@media (min-width: ${breakpoints[key]}px)`,
  down: (key: keyof typeof breakpoints) => `@media (max-width: ${breakpoints[key] - 0.05}px)`,
  between: (start: keyof typeof breakpoints, end: keyof typeof breakpoints) =>
    `@media (min-width: ${breakpoints[start]}px) and (max-width: ${breakpoints[end] - 0.05}px)`,
};

// Responsive spacing
export const spacing = {
  tiny: '4px',
  small: '8px',
  medium: '16px',
  large: '24px',
  xlarge: '32px',
  xxlarge: '48px',
};

// Responsive typography
export const typography = {
  h1: {
    fontSize: {
      xs: '2rem',
      sm: '2.5rem',
      md: '3rem',
    },
    lineHeight: {
      xs: 1.2,
      sm: 1.3,
      md: 1.4,
    },
  },
  h2: {
    fontSize: {
      xs: '1.5rem',
      sm: '2rem',
      md: '2.5rem',
    },
    lineHeight: {
      xs: 1.2,
      sm: 1.3,
      md: 1.4,
    },
  },
  body1: {
    fontSize: {
      xs: '0.875rem',
      sm: '1rem',
      md: '1.125rem',
    },
    lineHeight: {
      xs: 1.4,
      sm: 1.5,
      md: 1.6,
    },
  },
};

// Responsive layout helpers
export const layout = {
  container: {
    padding: {
      xs: spacing.medium,
      sm: spacing.large,
      md: spacing.xlarge,
    },
    maxWidth: {
      sm: '600px',
      md: '960px',
      lg: '1280px',
    },
  },
  grid: {
    spacing: {
      xs: 1,
      sm: 2,
      md: 3,
    },
  },
};

// Responsive component styles
export const components = {
  card: {
    padding: {
      xs: spacing.small,
      sm: spacing.medium,
      md: spacing.large,
    },
    borderRadius: {
      xs: '8px',
      sm: '12px',
      md: '16px',
    },
  },
  button: {
    padding: {
      xs: `${spacing.small} ${spacing.medium}`,
      sm: `${spacing.medium} ${spacing.large}`,
      md: `${spacing.medium} ${spacing.xlarge}`,
    },
    fontSize: {
      xs: '0.875rem',
      sm: '1rem',
      md: '1.125rem',
    },
  },
};

// Helper function to get responsive value
export function getResponsiveValue<T>(
  theme: Theme,
  values: { [key in keyof typeof breakpoints]?: T },
  defaultValue: T
): T {
  const breakpoint = theme.breakpoints.values;
  const currentBreakpoint = Object.keys(breakpoint).find(
    (key) => window.innerWidth >= breakpoint[key as keyof typeof breakpoint]
  ) as keyof typeof breakpoints;

  return values[currentBreakpoint] || defaultValue;
}

// Responsive mixins
export const mixins = {
  flexCenter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flexColumn: {
    display: 'flex',
    flexDirection: 'column',
  },
  flexBetween: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gridContainer: {
    display: 'grid',
    gap: {
      xs: spacing.medium,
      sm: spacing.large,
      md: spacing.xlarge,
    },
  },
  hideOnMobile: {
    display: {
      xs: 'none',
      sm: 'block',
    },
  },
  showOnMobile: {
    display: {
      xs: 'block',
      sm: 'none',
    },
  },
}; 