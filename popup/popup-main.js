const { createApp } = Vue;

createApp({
  data() {
    return {
      title: "Vue у розширенні працює",
      message: "Це окрема тестова сторінка без втручання в існуючий popup.",
      count: 0
    };
  }
}).mount("#app");