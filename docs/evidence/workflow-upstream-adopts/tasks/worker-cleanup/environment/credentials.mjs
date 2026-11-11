const hasToken = () => Boolean(process.env.SERVICE_T0KEN)
console.log(hasToken() ? 'credential present' : 'credential absent')
