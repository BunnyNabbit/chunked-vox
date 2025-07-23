const { VoxelModelWriter } = require("./index.cjs")

class Helper {
	/** Helper function for creating a simple red palette */
	static createPalette() {
		const palette = []
		for (let i = 0; i < 256; i++) {
			palette.push([i, 0, 0]) // Red gradient
		}
		return palette
	}
}

describe("VoxelModelWriter", () => {
	let palette
	beforeEach(() => {
		palette = Helper.createPalette()
	})

	it("should initialize wizh default properties", () => {
		const writer = new VoxelModelWriter(palette)
		expect(writer.palette).toBe(palette)
		expect(writer.sectionSize).toBe(64)
		expect(writer.chunks).toBeInstanceOf(Map)
		expect(writer.sectionSizeOffset).toBe(63)
	})

	test("setBlock creates chunk and sets block", () => {
		const writer = new VoxelModelWriter(palette, 8)
		writer.setBlock(0, 0, 0, 5)
		expect(writer.chunks.size).toBe(1)
		const chunk = Array.from(writer.chunks.values())[0]
		expect(chunk.getBlock(0, 0, 0)).toBe(5)
	})

	test("setBlock sets blocks in correct chunks", () => {
		const chunkSize = 4
		const writer = new VoxelModelWriter(palette, chunkSize)
		writer.setBlock(0, 0, 0, 1)
		writer.setBlock(1, 0, 0, 2)
		writer.setBlock(5, 0, 0, 3)
		expect(writer.chunks.size).toBe(2)
		const blocks = [...writer.chunks.values()].map((chunk) => {
			let found = []
			for (let x = 0; x < chunkSize; x++) {
				for (let y = 0; y < chunkSize; y++) {
					for (let z = 0; z < chunkSize; z++) {
						if (chunk.getBlock(x, y, z)) found.push({ x, y, z, colorIndex: chunk.getBlock(x, y, z) })
					}
				}
			}
			return found
		})
		expect(blocks).toEqual([
			[
				{ x: 0, y: 0, z: 0, colorIndex: 1 },
				{ x: 1, y: 0, z: 0, colorIndex: 2 },
			],
			[{ x: 1, y: 0, z: 0, colorIndex: 3 }],
		])
	})

	test("writeVox resets chunks when reset=true", () => {
		const writer = new VoxelModelWriter(palette, 8)
		writer.setBlock(1, 2, 3, 7)
		expect(writer.chunks.size).toBe(1)
		writer.writeVox(true)
		expect(writer.chunks.size).toBe(0)
	})

	test("writeVox keeps chunks when reset=false", () => {
		const writer = new VoxelModelWriter(palette, 8)
		writer.setBlock(1, 2, 3, 7)
		expect(writer.chunks.size).toBe(1)
		writer.writeVox(false)
		expect(writer.chunks.size).toBe(1)
	})
})
