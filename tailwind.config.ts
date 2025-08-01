import type { Config } from "tailwindcss";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			fontFamily: {
				'brockmann': ['Brockmann', 'serif'],
				'brockmann-regular': ['Brockmann', 'serif'],
				'brockmann-medium': ['Brockmann', 'serif'],
				'brockmann-semibold': ['Brockmann', 'serif'],
				'brockmann-bold': ['Brockmann', 'serif'],
				'chaney': ['Chaney', 'serif'],
				'chaney-regular': ['Chaney', 'serif'],
				'chaney-wide': ['Chaney Wide', 'serif'],
				'chaney-extended': ['Chaney Extended', 'serif'],
				'chaney-ultra': ['Chaney Ultra Extended', 'serif'],
			},
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				// Design System Colors
				'brand-primary': 'hsl(var(--brand-primary))',
				'brand-primary-foreground': 'hsl(var(--brand-primary-foreground))',
				'purple-150': 'hsl(var(--purple-150))',
				'purple-200': 'hsl(var(--purple-200))',
				'purple-300': 'hsl(var(--purple-300))',
				'greyscale-blue-900': 'hsl(var(--greyscale-blue-900))',
				'greyscale-blue-800': 'hsl(var(--greyscale-blue-800))',
				'greyscale-blue-700': 'hsl(var(--greyscale-blue-700))',
				'greyscale-blue-600': 'hsl(var(--greyscale-blue-600))',
				'greyscale-blue-500': 'hsl(var(--greyscale-blue-500))',
				'greyscale-blue-200': 'hsl(var(--greyscale-blue-200))',
				'greyscale-blue-100': 'hsl(var(--greyscale-blue-100))',
				'ui-primary': 'hsl(var(--ui-primary))',
				'text-primary': 'hsl(var(--text-primary))',
				'yellow-500': 'hsl(var(--yellow-500))',
				'teal-100': 'hsl(var(--teal-100))',
				'teal-700': 'hsl(var(--teal-700))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))'
				}
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			keyframes: {
				'accordion-down': {
					from: {
						height: '0'
					},
					to: {
						height: 'var(--radix-accordion-content-height)'
					}
				},
				'accordion-up': {
					from: {
						height: 'var(--radix-accordion-content-height)'
					},
					to: {
						height: '0'
					}
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out'
			}
		}
	},
	plugins: [require("tailwindcss-animate")],
} satisfies Config;
