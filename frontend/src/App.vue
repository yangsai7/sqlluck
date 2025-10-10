<template>
  <div id="app">
    <router-view />
  </div>
</template>

<script setup>
// 这里可以添加全局逻辑
</script>

<style>
#app {
  height: 100vh;
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #2c3e50;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  height: 100vh;
  overflow: hidden;
}
</style>