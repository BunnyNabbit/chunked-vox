const { SmartBuffer } = require("smart-buffer")
const ndarray = require("ndarray")
class Vector3 {
	/**@todo Yet to be documented.
	 * @param {number} x
	 * @param {number} y
	 * @param {number} z
	 */
	constructor(x, y, z) {
		this.x = x
		this.y = y
		this.z = z
	}
	/**@todo Yet to be documented.
	 * @param {Vector3} vec3
	 * @param {string} separator
	 */
	static toKey(vec3, separator) {
		return vec3.x + separator + vec3.y + separator + vec3.z
	}
	/**@todo Yet to be documented.
	 * @param {string} key
	 * @param {string} separator
	 */
	static fromKey(key, separator) {
		let components = key.split(separator).map((component) => parseInt(component))
		return new Vector3(components[0], components[1], components[2])
	}
}
/** A cluster of voxels. */
class Section {
	/**@todo Yet to be documented.
	 * @param {number} sectionSize
	 */
	constructor(sectionSize) {
		this.data = ndarray(new Uint8Array(sectionSize * sectionSize * sectionSize), [sectionSize, sectionSize, sectionSize])
	}
	/**Sets a voxel within the section with a color palette index.
	 * @param {number} x - X coordinate of voxel.
	 * @param {number} y - Y coordinate of voxel.
	 * @param {number} z - Z coordinate of voxel.
	 * @param {number} i - Color palette index.
	 */
	setBlock(x, y, z, i) {
		this.data.set(x, y, z, i)
	}
	/**Gets color palette index of a coordinate within the section.
	 * @param {number} x - X coordinate of voxel.
	 * @param {number} y - Y coordinate of voxel.
	 * @param {number} z - Z coordinate of voxel.
	 * @returns {number} The color palette index, Zero (0) meaning unset.
	 */
	getBlock(x, y, z) {
		return this.data.get(x, y, z)
	}
}

/**Class for writing large voxel models in MagicaVoxel format.
 * @example
 * ```js
 * function generateGrayscalePalette() {
 *		const palette = []
 *		for (let index = 0; index < 256; index++) {
 *			palette.push([index, index, index]) // RGB
 *		}
 *		return palette
 *	}
 * const voxelModel = new VoxelModelWriter(generateGrayscalePalette())
 *
 *	// generate random model
 *	function randomIntFromInterval(min, max) {
 *		return Math.floor(Math.random() * (max - min + 1) + min)
 *	}
 *
 *	const modelSize = 368
 *	for (let x = 0; x < modelSize; x++) {
 *		for (let y = 0; y < modelSize; y++) {
 *			voxelModel.setBlock(x, y, 0, randomIntFromInterval(0, 255))
 *		}
 *	}
 *
 * const buffer = voxelModel.writeVox()
 * ```
 */
class VoxelModelWriter {
	/**Creates a VoxelModelWriter instance.
	 * @param {Array.<[number, number, number]>} palette - An array of RGB color triplets for the voxel model palette.
	 * @param {number} [sectionSize=64] Size of the sparse models as chunks.
	 */
	constructor(palette, sectionSize = 64) {
		this.chunks = new Map()
		this.palette = palette
		this.sectionSize = sectionSize
		this.sectionSizeOffset = this.sectionSize - 1
	}
	/**Set a voxel with a color palette index. Z is gravity direction.
	 * @param {number} x - X coordinate of voxel.
	 * @param {number} y - Y coordinate of voxel.
	 * @param {number} z - Z coordinate of voxel.
	 * @param {number} i - Color palette index.
	 */
	setBlock(x, y, z, i) {
		const key = Vector3.toKey(new Vector3(Math.floor(x / this.sectionSize), Math.floor(y / this.sectionSize), Math.floor(z / this.sectionSize)), " ")
		let chunk = this.chunks.get(key)
		if (!chunk) {
			chunk = new Section(this.sectionSize)
			this.chunks.set(key, chunk)
		}
		chunk.setBlock(x & this.sectionSizeOffset, y & this.sectionSizeOffset, z & this.sectionSizeOffset, i)
	}
	/**Generate a MagicaVoxel formatted buffer.
	 * @param {boolean} [releaseInternalData=false] Release internal data used for representing model.
	 * @returns {Buffer} A buffer containing the voxel model in MagicaVoxel format.
	 */
	writeVox(releaseInternalData = false) {
		const fileBuffer = new SmartBuffer()
		fileBuffer.writeString("VOX ")
		fileBuffer.writeInt32LE(150) // version
		fileBuffer.writeString("MAIN")
		const mainChunk = new SmartBuffer()
		this.chunks.forEach((chunk) => {
			// write voxel chunks
			mainChunk.writeString("SIZE")
			mainChunk.writeInt32LE(12) // content length
			mainChunk.writeInt32LE(0) // children length
			mainChunk.writeInt32LE(this.sectionSize)
			mainChunk.writeInt32LE(this.sectionSize)
			mainChunk.writeInt32LE(this.sectionSize)
			mainChunk.writeString("XYZI")
			let voxelCount = 0
			const xyziBuffer = new SmartBuffer()
			for (let x = 0; x < this.sectionSize; x++) {
				for (let y = 0; y < this.sectionSize; y++) {
					for (let z = 0; z < this.sectionSize; z++) {
						const voxel = chunk.getBlock(x, y, z)
						if (voxel) {
							xyziBuffer.writeInt8(x)
							xyziBuffer.writeInt8(y)
							xyziBuffer.writeInt8(z)
							xyziBuffer.writeUInt8(voxel)
							voxelCount++
						}
					}
				}
			}
			mainChunk.writeInt32LE(xyziBuffer.length + 4) // content length
			mainChunk.writeInt32LE(0) // children length
			mainChunk.writeInt32LE(voxelCount)
			mainChunk.writeBuffer(xyziBuffer.toBuffer())
			if (releaseInternalData) chunk.data = null
		})
		let nodeIndex = 2
		let modelIndex = 0

		mainChunk.writeString("nTRN")
		const transformRootNodeChunk = new SmartBuffer()
		transformRootNodeChunk.writeInt32LE(0) // transform index
		VoxelModelWriter.writeDict(transformRootNodeChunk, {})
		transformRootNodeChunk.writeInt32LE(1) // node index of the group
		transformRootNodeChunk.writeInt32LE(-1) // reserved index (unused?)
		transformRootNodeChunk.writeInt32LE(-1) // layer index (not used)
		transformRootNodeChunk.writeInt32LE(1) // number of frames (always 1)
		VoxelModelWriter.writeDict(transformRootNodeChunk, {})
		mainChunk.writeInt32LE(transformRootNodeChunk.length) // content length
		mainChunk.writeInt32LE(0) // children length
		mainChunk.writeBuffer(transformRootNodeChunk.toBuffer())

		mainChunk.writeString("nGRP")
		const groupNodeChunk = new SmartBuffer()
		groupNodeChunk.writeInt32LE(1) // node index of the shape
		VoxelModelWriter.writeDict(groupNodeChunk, {})
		groupNodeChunk.writeInt32LE(this.chunks.size) // number of children nodes
		for (let index = 0; index < this.chunks.size; index++) {
			// children nodes (transform nodes)
			groupNodeChunk.writeInt32LE(index * 2 + 2)
		}
		mainChunk.writeInt32LE(groupNodeChunk.length) // content length
		mainChunk.writeInt32LE(0) // children length
		mainChunk.writeBuffer(groupNodeChunk.toBuffer())

		this.chunks.forEach((chunk, key) => {
			// write shape nodes and transforms
			mainChunk.writeString("nTRN")
			const transformNodeChunk = new SmartBuffer()
			transformNodeChunk.writeInt32LE(nodeIndex)
			VoxelModelWriter.writeDict(transformNodeChunk, {})
			transformNodeChunk.writeInt32LE(nodeIndex + 1) // node index of the shape
			transformNodeChunk.writeInt32LE(-1) // reserved index (unused?)
			transformNodeChunk.writeInt32LE(-1) // layer index (not used)
			transformNodeChunk.writeInt32LE(1) // number of frames (always 1)
			// a frame
			const vec3 = Vector3.fromKey(key, " ")
			VoxelModelWriter.writeDict(transformNodeChunk, {
				_t: Vector3.toKey({ x: vec3.x * this.sectionSize, y: vec3.y * this.sectionSize, z: vec3.z * this.sectionSize + Math.floor(this.sectionSize / 2) }, " "),
			})
			mainChunk.writeInt32LE(transformNodeChunk.length) // content length
			mainChunk.writeInt32LE(0) // children length
			mainChunk.writeBuffer(transformNodeChunk.toBuffer())
			nodeIndex++

			let shapeNodeChunk = new SmartBuffer()
			mainChunk.writeString("nSHP")
			shapeNodeChunk.writeInt32LE(nodeIndex)
			VoxelModelWriter.writeDict(shapeNodeChunk, {})
			nodeIndex++
			shapeNodeChunk.writeInt32LE(1) // model count. shape nodes always have 1
			shapeNodeChunk.writeInt32LE(modelIndex)
			modelIndex++
			VoxelModelWriter.writeDict(shapeNodeChunk, {})
			mainChunk.writeInt32LE(shapeNodeChunk.length) // content length
			mainChunk.writeInt32LE(0) // children length
			mainChunk.writeBuffer(shapeNodeChunk.toBuffer())
		})
		if (releaseInternalData) this.chunks = new Map()
		// write palette
		mainChunk.writeString("RGBA")
		mainChunk.writeInt32LE(1024) // content length
		mainChunk.writeInt32LE(0) // children length
		for (var index = 0; index < 256; index++) {
			const element = this.palette[index]
			mainChunk.writeUInt8(element[0])
			mainChunk.writeUInt8(element[1])
			mainChunk.writeUInt8(element[2])
			mainChunk.writeUInt8(255)
		}

		fileBuffer.writeInt32LE(0) // children length
		fileBuffer.writeInt32LE(mainChunk.length)
		fileBuffer.writeBuffer(mainChunk.toBuffer())
		return fileBuffer.toBuffer()
	}
	/**Writes a key-value dictionary structure to the buffer.
	 * @param {SmartBuffer} buffer - The buffer to write the dictionary with.
	 * @param {{}} [object={}] The object used as a key-value dictionary.
	 */
	static writeDict(buffer, object = {}) {
		buffer.writeInt32LE(Object.keys(object).length)
		for (const [key, value] of Object.entries(object)) {
			VoxelModelWriter.writeAsciiString(buffer, key)
			VoxelModelWriter.writeAsciiString(buffer, value)
		}
	}
	/**Writes an ASCII-formatted string to the buffer.
	 * @param {SmartBuffer} buffer - The buffer used for writing the string to.
	 * @param {string} string - The string to write with.
	 */
	static writeAsciiString(buffer, string) {
		const asciiBuffer = Buffer.from(string, "ascii")
		buffer.writeInt32LE(asciiBuffer.length)
		buffer.writeBuffer(asciiBuffer)
	}
}

module.exports = {
	VoxelModelWriter,
}
