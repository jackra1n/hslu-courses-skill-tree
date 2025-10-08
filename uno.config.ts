import { defineConfig, presetIcons, presetTypography, presetWebFonts, presetWind4 } from 'unocss'

export default defineConfig({
    presets: [
        presetWind4(),
        presetTypography(),
        presetIcons({
            scale: 1.2,
            warn: true,
        }),
        presetWebFonts({
            provider: 'google',
            fonts: {
                sans: 'Inter:400,500,600,700',
                mono: 'JetBrains Mono:400,500',
            }
        })
    ]
})