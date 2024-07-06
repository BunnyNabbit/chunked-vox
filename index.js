const SmartBuffer = require("smart-buffer").SmartBuffer
const ndarray = require("ndarray")
function vec3Key(vec3, separator) {
	return vec3.x + separator + vec3.y + separator + vec3.z
}
function keyToVec3(key, separator) {
	let components = key.split(separator)
	return new Vector3(components[0], components[1], components[2])
}
class Vector3 {
	constructor(x, y, z) {
		this.x = x
		this.y = y
		this.z = z
	}
}
class Section {
	constructor(sectionSize) {
		this.data = ndarray(new Uint8Array(sectionSize * sectionSize * sectionSize), [sectionSize, sectionSize, sectionSize])
	}
	setBlock(x, y, z, i) {
		this.data.set(x, y, z, i)
	}
	getBlock(x, y, z) {
		return this.data.get(x, y, z)
	}
}

class VoxelModelWriter {
	constructor(palette, sectionSize = 64) {
		this.chunks = new Map()
		this.palette = palette
		this.sectionSize = sectionSize
		this.sectionSizeOffset = this.sectionSize - 1
	}
	// MagicaVoxel coord system (Z is gravity direction)
	setBlock(x, y, z, i) {
		const key = vec3Key(new Vector3(Math.floor(x / this.sectionSize), Math.floor(y / this.sectionSize), Math.floor(z / this.sectionSize)), " ")
		let chunk = this.chunks.get(key)
		if (!chunk) {
			chunk = new Section(this.sectionSize)
			this.chunks.set(key, chunk)
		}
		chunk.setBlock(x & this.sectionSizeOffset, y & this.sectionSizeOffset, z & this.sectionSizeOffset, i)
	}
	writeVox(reset) { // if reset, internal data will be released during writing.
		function writeAsciiString(buffer, str) {
			const asciiBuffer = Buffer.from(str, "ascii")
			buffer.writeInt32LE(asciiBuffer.length)
			buffer.writeBuffer(asciiBuffer)
		}
		function writeDict(buffer, object = {}) {
			buffer.writeInt32LE(Object.keys(object).length)
			for (const [key, value] of Object.entries(object)) {
				writeAsciiString(buffer, key)
				writeAsciiString(buffer, value)
			}
		}
		const fileBuffer = new SmartBuffer()
		fileBuffer.writeString("VOX ")
		fileBuffer.writeInt32LE(150) // version
		fileBuffer.writeString("MAIN")
		const mainChunk = new SmartBuffer()
		this.chunks.forEach((chunk) => { // write voxel chunks
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
			if (reset) chunk.data = null
		})
		let nodeIndex = 2
		let modelIndex = 0

		mainChunk.writeString("nTRN")
		const transformRootNodeChunk = new SmartBuffer()
		transformRootNodeChunk.writeInt32LE(0) // transform index
		writeDict(transformRootNodeChunk, {})
		transformRootNodeChunk.writeInt32LE(1) // node index of the group
		transformRootNodeChunk.writeInt32LE(-1) // reserved index (unused?)
		transformRootNodeChunk.writeInt32LE(-1) // layer index (not used)
		transformRootNodeChunk.writeInt32LE(1) // number of frames (always 1)
		writeDict(transformRootNodeChunk, {})
		mainChunk.writeInt32LE(transformRootNodeChunk.length) // content length
		mainChunk.writeInt32LE(0) // children length
		mainChunk.writeBuffer(transformRootNodeChunk.toBuffer())

		mainChunk.writeString("nGRP")
		const groupNodeChunk = new SmartBuffer()
		groupNodeChunk.writeInt32LE(1) // node index of the shape
		writeDict(groupNodeChunk, {})
		groupNodeChunk.writeInt32LE(this.chunks.size) // number of children nodes
		// console.log(this.chunks.size)
		for (let index = 0; index < this.chunks.size; index++) { // children nodes (transform nodes)
			// console.log((index * 2) + 2)
			groupNodeChunk.writeInt32LE((index * 2) + 2)
		}
		mainChunk.writeInt32LE(groupNodeChunk.length) // content length
		mainChunk.writeInt32LE(0) // children length
		mainChunk.writeBuffer(groupNodeChunk.toBuffer())

		this.chunks.forEach((chunk, key) => { // write shape nodes and transforms
			mainChunk.writeString("nTRN")
			const transformNodeChunk = new SmartBuffer()
			transformNodeChunk.writeInt32LE(nodeIndex)
			writeDict(transformNodeChunk, {})
			transformNodeChunk.writeInt32LE(nodeIndex + 1) // node index of the shape
			transformNodeChunk.writeInt32LE(-1) // reserved index (unused?)
			transformNodeChunk.writeInt32LE(-1) // layer index (not used)
			transformNodeChunk.writeInt32LE(1) // number of frames (always 1)
			// a frame
			const vec3 = keyToVec3(key, " ")
			// console.log(vec3)
			writeDict(transformNodeChunk, {
				_t: vec3Key({ x: vec3.x * this.sectionSize, y: vec3.y * this.sectionSize, z: (vec3.z * this.sectionSize) + (Math.floor(this.sectionSize / 2)) }, " "),
			})
			mainChunk.writeInt32LE(transformNodeChunk.length) // content length
			mainChunk.writeInt32LE(0) // children length
			mainChunk.writeBuffer(transformNodeChunk.toBuffer())
			nodeIndex++

			let shapeNodeChunk = new SmartBuffer()
			mainChunk.writeString("nSHP")
			shapeNodeChunk.writeInt32LE(nodeIndex)
			writeDict(shapeNodeChunk, {})
			nodeIndex++
			shapeNodeChunk.writeInt32LE(1) // model count. shape nodes always have 1
			shapeNodeChunk.writeInt32LE(modelIndex)
			modelIndex++
			writeDict(shapeNodeChunk, {})
			mainChunk.writeInt32LE(shapeNodeChunk.length) // content length
			mainChunk.writeInt32LE(0) // children length
			mainChunk.writeBuffer(shapeNodeChunk.toBuffer())
		})
		if (reset) this.chunks = new Map()
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
			// if (index === 0) {
			// 	mainChunk.writeUInt8(0)
			// } else mainChunk.writeUInt8(255)
		}

		fileBuffer.writeInt32LE(0) // children length
		fileBuffer.writeInt32LE(mainChunk.length)
		fileBuffer.writeBuffer(mainChunk.toBuffer())
		return fileBuffer.toBuffer()
	}
}

module.exports = {
	VoxelModelWriter
}