import axios from "axios"
import headers from "./body.json" assert { type: "json" }
import minimist from "minimist"
import env from "dotenv"

// EXAMPLE to run: node index.js --ip 172.31.0.241 --id 31321312

// set up path to project in your system
env.config({ path: "" })

async function index() {
  const argv = minimist(process.argv.slice(2))
  const idName = !argv.id ? "99999" : `${argv.id}`.trim()
  const username = process.env.LGN ? process.env.LGN : ""
  const password = process.env.PSWD ? process.env.PSWD : ""
  const ntp = process.env.NTP ? process.env.NTP : ""
  let authCookie = ""

  if (!argv.ip) {
    console.log("Необходимо указать IP")
    return
  }

  if (!username || !password) {
    console.log("Необходимо указать логин и пароль")
    return
  }

  const link = `http://${argv.ip}/mqtt`

  const check = async () => {
    const data = await request("check")
    return data
  }

  const sleep = async () => {
    return new Promise((res) => {
      setTimeout(() => res(true), 1000)
    })
  }

  const encodeBase = (string) => {
    return Buffer.from(string).toString("base64")
  }
  const decodeBase = (string) => {
    return Buffer.from(string, "base64").toString("ascii")
  }

  const request = async (type, headersBody = headers[type]) => {
    try {
      const req = await axios.post(link, headersBody, { headers: { cookie: authCookie }, timeout: 5000 })
      await sleep()
      if (req.status === 200) {
        if (type === "auth") {
          authCookie = req.headers["set-cookie"][0]
        }
        if (type === "cameraId") {
          headers[type]
        }
        return { status: true, data: req.data, code: req.status }
      } else {
        console.log(`Произошла ошибка: ${req.error}, Статус: ${req.status}`)
        return { status: false, data: req.data, code: req.status }
      }
    } catch (error) {
      console.log(`Произошла ошибка или хост недоступен: ${error.message}`)
      return { status: false, data: error.message, code: error.status }
    }
  }

  const reConnect = async (count = 0) => {
    console.log(`Соединение, попытка: ${count}`)
    const req = await login()
    const tries = 5
    if (req.code !== 200 && count < tries) {
      return await reConnect((count += 1))
    }
    if (req.code !== 200 && count >= tries) {
      console.log(`Хост: ${argv.ip} не доступен`)
      process.exit(1)
    }
    return
  }

  const login = async () => {
    const template = headers["auth"]
    const dataString = JSON.parse(template.data)
    dataString.credentials = encodeBase(`${username}:${password}`)
    template.data = JSON.stringify(dataString)

    const data = await request("auth", template)
    if (!data.status) {
      console.log(`${argv.ip}: Авторизация: ОШИБКА`)
      return data
    }
    console.log(`${argv.ip}: Авторизация: OK`)
    return data
  }

  const logout = async () => {
    const data = await request("exit")
    if (!data.status) {
      console.log(`${argv.ip}: Выход из учетной записи: ОШИБКА`)
      return
    }
    console.log(`${argv.ip}: Выход из учетной записи: OK`)
  }

  const setNtp = async () => {
    const template = headers["cameraId"]
    const dataString = JSON.parse(template.data)
    let decode = JSON.parse(decodeBase(dataString.payload))
    decode.ntpPool = ntp
    dataString.payload = encodeBase(JSON.stringify(decode))
    template.data = JSON.stringify(dataString)

    const data = await request("ntp", template)
    if (!data.status) {
      console.log(`${argv.ip}: Установка NTP: ОШИБКА`)
      return
    }
    console.log(`${argv.ip}: \u2713 Установка NTP: OK`)
  }

  const setId = async () => {
    const template = headers["cameraId"]
    const dataString = JSON.parse(template.data)
    let decode = JSON.parse(decodeBase(dataString.payload))
    decode.name = idName
    dataString.payload = encodeBase(JSON.stringify(decode))
    template.data = JSON.stringify(dataString)

    const data = await request("cameraId", template)
    if (!data.status) {
      console.log(`${argv.ip}: Установка ID: ОШИБКА`)
      return
    }
    console.log(`${argv.ip}: \u2713 Установка ID: OK`)
  }

  const setUserAdmin = async () => {
    const data = await request("userAdmin")
    if (!data.status) {
      console.log(`${argv.ip}: Установка пользователя admin: ОШИБКА`)
      return
    }
    console.log(`${argv.ip}: \u2713 Установка пользователя admin: OK`)
  }

  const deleteUserRTSP = async () => {
    const data = await request("deleteUserRtsp")
    if (!data.status) {
      console.log(`${argv.ip}: Удаление пользователя rtsp: ОШИБКА`)
      return
    }
    console.log(`${argv.ip}: \u2713 Удаление пользователя rtsp: OK`)
  }

  const setUserRTSP = async () => {
    const data = await request("userRtsp")
    if (!data.status) {
      console.log("Установить пользователя rtsp не удалось")
      return
    }
    console.log(`${argv.ip}: \u2713 Установка пользователя rtsp: OK`)
  }

  const FUNCTIONS_MAP = {
    setId: { func: setId, reload: false },
    setNtp: { func: setNtp, reload: true },
    setUserAdmin: { func: setUserAdmin, reload: true },
    deleteUserRTSP: { func: deleteUserRTSP, reload: true },
    setUserRTSP: { func: setUserRTSP, reload: false },
    logout: { func: logout, reload: false },
  }

  const orderFunctions = ["setId", "setNtp", "setUserAdmin", "deleteUserRTSP", "setUserRTSP", "logout"]

  for (let i = 0; i < orderFunctions.length; i++) {
    const currentFunc = FUNCTIONS_MAP[orderFunctions[i]]
    if (i === 0) {
      await reConnect()
    }
    await currentFunc.func()
    if (currentFunc.reload) {
      await reConnect()
    }
  }
}

index()
