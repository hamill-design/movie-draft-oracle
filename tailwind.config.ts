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
				
				// Brand Colors
				'brand-primary': 'hsl(var(--brand-primary))',
				'brand-primary-foreground': 'hsl(var(--brand-primary-foreground))',
				
				// Purple Scale
				purple: {
					50: 'hsl(var(--purple-50))',
					100: 'hsl(var(--purple-100))',
					150: 'hsl(var(--purple-150))',
					200: 'hsl(var(--purple-200))',
					300: 'hsl(var(--purple-300))',
					400: 'hsl(var(--purple-400))',
					500: 'hsl(var(--purple-500))',
					600: 'hsl(var(--purple-600))',
					700: 'hsl(var(--purple-700))',
					800: 'hsl(var(--purple-800))',
					900: 'hsl(var(--purple-900))',
				},
				
				// Greyscale Blue Scale
				'greyscale-blue': {
					100: 'hsl(var(--greyscale-blue-100))',
					150: 'hsl(var(--greyscale-blue-150))',
					200: 'hsl(var(--greyscale-blue-200))',
					300: 'hsl(var(--greyscale-blue-300))',
					400: 'hsl(var(--greyscale-blue-400))',
					500: 'hsl(var(--greyscale-blue-500))',
					600: 'hsl(var(--greyscale-blue-600))',
					700: 'hsl(var(--greyscale-blue-700))',
					800: 'hsl(var(--greyscale-blue-800))',
					900: 'hsl(var(--greyscale-blue-900))',
				},
				
				// Greyscale Scale
				greyscale: {
					100: 'hsl(var(--greyscale-100))',
					200: 'hsl(var(--greyscale-200))',
					300: 'hsl(var(--greyscale-300))',
					400: 'hsl(var(--greyscale-400))',
					500: 'hsl(var(--greyscale-500))',
					600: 'hsl(var(--greyscale-600))',
					700: 'hsl(var(--greyscale-700))',
					800: 'hsl(var(--greyscale-800))',
					900: 'hsl(var(--greyscale-900))',
					1000: 'hsl(var(--greyscale-1000))',
				},
				
				// Orange Scale
				orange: {
					100: 'hsl(var(--orange-100))',
					200: 'hsl(var(--orange-200))',
					300: 'hsl(var(--orange-300))',
					400: 'hsl(var(--orange-400))',
					500: 'hsl(var(--orange-500))',
					600: 'hsl(var(--orange-600))',
					700: 'hsl(var(--orange-700))',
					800: 'hsl(var(--orange-800))',
					900: 'hsl(var(--orange-900))',
				},
				
				// Yellow Scale
				yellow: {
					100: 'hsl(var(--yellow-100))',
					200: 'hsl(var(--yellow-200))',
					300: 'hsl(var(--yellow-300))',
					400: 'hsl(var(--yellow-400))',
					500: 'hsl(var(--yellow-500))',
					600: 'hsl(var(--yellow-600))',
					700: 'hsl(var(--yellow-700))',
					800: 'hsl(var(--yellow-800))',
					900: 'hsl(var(--yellow-900))',
				},
				
				// Teal Scale
				teal: {
					100: 'hsl(var(--teal-100))',
					200: 'hsl(var(--teal-200))',
					300: 'hsl(var(--teal-300))',
					400: 'hsl(var(--teal-400))',
					500: 'hsl(var(--teal-500))',
					600: 'hsl(var(--teal-600))',
					700: 'hsl(var(--teal-700))',
					800: 'hsl(var(--teal-800))',
					900: 'hsl(var(--teal-900))',
				},
				
				// Blue Scale
				blue: {
					100: 'hsl(var(--blue-100))',
					200: 'hsl(var(--blue-200))',
					300: 'hsl(var(--blue-300))',
					400: 'hsl(var(--blue-400))',
					500: 'hsl(var(--blue-500))',
					600: 'hsl(var(--blue-600))',
					700: 'hsl(var(--blue-700))',
					800: 'hsl(var(--blue-800))',
					900: 'hsl(var(--blue-900))',
				},
				
				// Error Red Scale
				'error-red': {
					100: 'hsl(var(--error-red-100))',
					200: 'hsl(var(--error-red-200))',
					300: 'hsl(var(--error-red-300))',
					400: 'hsl(var(--error-red-400))',
					500: 'hsl(var(--error-red-500))',
					600: 'hsl(var(--error-red-600))',
					700: 'hsl(var(--error-red-700))',
					800: 'hsl(var(--error-red-800))',
					900: 'hsl(var(--error-red-900))',
				},
				
				// Positive Green Scale
				'positive-green': {
					100: 'hsl(var(--positive-green-100))',
					200: 'hsl(var(--positive-green-200))',
					300: 'hsl(var(--positive-green-300))',
					400: 'hsl(var(--positive-green-400))',
					500: 'hsl(var(--positive-green-500))',
					600: 'hsl(var(--positive-green-600))',
					700: 'hsl(var(--positive-green-700))',
					800: 'hsl(var(--positive-green-800))',
					900: 'hsl(var(--positive-green-900))',
				},
				
				// UI Tokens
				'ui-primary': 'hsl(var(--ui-primary))',
				'ui-bg': 'hsl(var(--ui-bg))',
				'ui-highlight': 'hsl(var(--ui-highlight))',
				'text-primary': 'hsl(var(--text-primary))',
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
