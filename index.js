const fs = require('fs')

const INPUT_DIR = './input'
const OUTPUT_DIR = './output'

const STATUS_AWAIT_FLAG = 0
const STATUS_PARSE_FILENAME_BYTES = 1
const STATUS_PARSE_FILENAME = 2
const STATUS_DATA_READ = 100

var currStatus = STATUS_AWAIT_FLAG
//
var nextFileNameBytes = 0
var fileNameHexArr = []
var fileNameStringArr = []
//
var capturedFlags = []
var dataPayload = []
var imageIndex = 0

fs.readdir(INPUT_DIR, async (err,files)=>{
    for(indx = 0; indx < files.length; indx++){
        let file = files[indx]
        let fileType = file.substring(
            file.lastIndexOf('.')+1
        ).toLowerCase()
        console.log(fileType)
        await parseFile(`${INPUT_DIR}/${file}`,fileType)
    }
})


async function parseFile(path,fileType){
    fs.open(path, 'r', (err,fd)=>{
        if(err)
            return console.log(err)
        let buffer = Buffer.alloc(1)

        currStatus = STATUS_PARSE_FILENAME_BYTES
        let pointer_X = 0
        let pointer_Y = 0
        while(true){
            let size = fs.readSync(fd, buffer, 0, 1, null)
            let hex = buffer.toString('hex')

            if(currStatus == STATUS_DATA_READ){
                if(capturedFlags.length +1 > 4)
                    capturedFlags.shift()
                capturedFlags.push(hex)
                if(fileType == 'jmg'){
                    dataPayload.push(hex)
                    if(capturedFlags.join('') == 'ffd9ffd8' || size == 0){
                        //end of jpeg
                        let imgData = dataPayload.join('')
                        dataPayload = []
                        let imgBuffer = Buffer.from(imgData,'hex')
                        let imgPath = `${OUTPUT_DIR}/${fileNameStringArr[imageIndex]}`
                        fs.writeFileSync(imgPath,imgBuffer)
                        console.log(`writing -> ${fileNameStringArr[imageIndex]}`)
                        if(size == 0){
                            break
                        }
                        imageIndex++
                        
                        currStatus = STATUS_DATA_READ
                        dataPayload.push('ffd8')
                    }
                }
                else if(fileType == 'bmg'){
                    dataPayload.push(hex)
                    if(capturedFlags.join('') == '0000424d' || size == 0){
                        //end of bmp
                        if(size != 0){//not FOE, trim last 2 byte
                            dataPayload = dataPayload.slice(0,-2)
                        }
                        let imgData = dataPayload.join('')
                        dataPayload = []
                        let imgBuffer = Buffer.from(imgData,'hex')
                        let imgPath = `${OUTPUT_DIR}/${fileNameStringArr[imageIndex]}`
                        fs.writeFileSync(imgPath,imgBuffer)
                        console.log(`writing -> ${fileNameStringArr[imageIndex]}`)
                        if(size == 0){
                            break
                        }
                        imageIndex++
                        
                        currStatus = STATUS_DATA_READ
                        dataPayload.push('424d')
                    }
                }
            }
            else if(currStatus == STATUS_AWAIT_FLAG){
                if(fileType == 'jmg'){
                    capturedFlags.push(hex)
                    if(capturedFlags.join('').endsWith('ffd8')){
                        currStatus = STATUS_DATA_READ
                        // is JPEG sign
                        dataPayload.push(...capturedFlags)
                    }
                }
                else if(fileType == 'bmg'){
                    capturedFlags.push(hex)
                    if(capturedFlags.join('').endsWith('424d')){
                        currStatus = STATUS_DATA_READ
                        // is BMP sign
                        dataPayload.push(...capturedFlags)
                    }
                }
            }
            else if(currStatus == STATUS_PARSE_FILENAME_BYTES){
                if(pointer_X == 2){
                    if(fileType == 'jmg'){
                        if(hex == 'ff'){
                            currStatus = STATUS_AWAIT_FLAG
                            capturedFlags.push(hex)
                        }
                    }
                    else if(fileType == 'bmg'){
                        if(hex == '42'){
                            currStatus = STATUS_AWAIT_FLAG
                            capturedFlags.push(hex)
                        }
                    }
                    
                    if(hex != '00' && currStatus == STATUS_PARSE_FILENAME_BYTES){
                        //begin to read x bytes for filename
                        nextFileNameBytes = parseInt(hex, 16)
                        currStatus = STATUS_PARSE_FILENAME
                    }
                }
            }
            else if(currStatus == STATUS_PARSE_FILENAME){
                //parse filename
                fileNameHexArr.push(hex)
                nextFileNameBytes--;
                if(nextFileNameBytes == 0){
                    currStatus = STATUS_PARSE_FILENAME_BYTES
                    let fileNameString = hexToAscii(fileNameHexArr.join(''))
                    console.log(`#${fileNameStringArr.length}->${fileNameString}`)
                    fileNameStringArr.push(fileNameString)
                    fileNameHexArr = []
                }
            }

            if(pointer_X == 15){
                pointer_X = 0
                pointer_Y++
            }
            else
                pointer_X++

        }
    })
}

function hexToAscii(payload){
    let hex = payload.toString()
    let out = ''
    for (var n = 0; n < hex.length; n += 2) {
		out += String.fromCharCode(parseInt(hex.substr(n, 2), 16))
	}
    return out
}