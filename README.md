# 8BitCommons

**10,000 on-chain 8-bit pixel art characters inscribed directly on Bitcoin via the Ordinals protocol.**

8BitCommons is a Bitcoin-native digital artifact collection celebrating retro 8-bit aesthetics — the golden era of pixel art, chiptunes, and classic video games. Every piece lives permanently on the Bitcoin blockchain as a true digital artifact.

## 🌟 Collection Overview

- **Supply**: 10,000 unique 8-bit characters
- **Format**: Bitcoin Ordinals inscriptions (no smart contracts, pure on-chain)
- **Style**: Hand-crafted and algorithmically composed retro pixel art
- **Chain**: Bitcoin (via Ordinals)
- **Website**: [8bitcommons.xyz](https://8bitcommons.xyz) *(coming soon)*
- **Twitter / X**: [@8bitcommons](https://x.com/8bitcommons) *(TBD)*

## 📁 Repository Structure

```
8BitCommons/
├── art/
│   ├── source/           # Original layered files, Aseprite/PSD sources
│   └── generated/        # Final inscribed PNGs + spritesheets
├── metadata/
│   └── *.json            # Ordinals-compatible inscription metadata
├── scripts/
│   ├── generators/       # Art generation, trait composition, rarity tools
│   └── inscriptions/     # Inscription helpers, ord CLI wrappers, batch tools
├── website/              # Mint site, gallery, roadmap (Next.js / static)
├── docs/                 # Lore, trait docs, technical specs, roadmaps
├── assets/               # Brand kit, press images, social templates
├── tests/                # Generators + metadata validation tests
├── .gitignore
└── README.md
```

## 🚀 Getting Started (for contributors / team)

```bash
git clone https://github.com/<org-or-username>/8BitCommons.git
cd 8BitCommons

# Install tools you need (examples)
# - Node.js (for website)
# - Python 3 (for generators)
# - ord (Bitcoin Ordinals CLI) for inscription work
```

See `docs/` for detailed guides once populated.

## 🛠️ Tech Stack & Tooling (proposed)

- **Art pipeline**: Aseprite + custom Python/Node generators for trait layers + rarity
- **Website**: Next.js 15 + Tailwind + shadcn/ui (or 8bit-styled components)
- **Metadata**: JSON following Ordinals / BRC-20 style conventions where applicable
- **Inscriptions**: `ord` wallet + custom batch inscription scripts
- **On-chain verification**: Bitcoin block explorers + Ordinals.com / Hiro

## 📜 License

Code and tooling in this repository are released under the [MIT License](LICENSE).

Art assets (PNGs, sprites, layered sources) are © 8BitCommons. Inscribed pieces on Bitcoin are owned by their respective holders per Ordinals protocol.

## 🗺️ Roadmap (High Level)

- [ ] Trait system design & art production (layers + palettes)
- [ ] Generator scripts + rarity engine
- [ ] Metadata + inscription pipeline
- [ ] Public mint / reveal website
- [ ] Community tools & on-chain utilities
- [ ] Future utility & expansions

## 🤝 Contributing

This is currently a founder-led project. If you're an 8-bit artist, Bitcoin dev, or Ordinals maximalist and want to help shape the collection, open an issue or reach out on X.

For now, the focus is on high-quality, authentic 8-bit execution.

## 📄 Additional Documentation

- `docs/roadmap.md` (planned)
- `docs/traits.md` (trait categories & palettes)
- `docs/inscription-guide.md` (how we inscribe at scale)

---

**8BitCommons — Pixel art that belongs on Bitcoin.**

*Built with love for the 8-bit era and the cypherpunk spirit of Bitcoin.*
