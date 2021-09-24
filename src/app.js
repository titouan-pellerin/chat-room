import "./main.scss";
import * as THREE from "three";
import gsap from "gsap";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { io } from "socket.io-client";

let currentUser;
const messages = [];
const users = [];
const usersMeshes = [];

const meshesPositions = [];

let INTERSECTED = null;
let raycasterOn = false;

let usernameInput,
  usernameForm,
  messageInput,
  messageForm,
  chatContainer,
  leftPaw,
  rightPaw,
  catCharacter,
  root,
  pseudoHover;

let pawPosition = 0;
let currentUserMesh;

let currentColor = 0xdbdbdb;
let colors = [0xdbdbdb, 0xd11b1d, 0x79b3fb, 0x265964, 0x5f309c, 0x9f335a];

/**
 * Debug
 */

window.addEventListener("DOMContentLoaded", () => {
  root = document.documentElement;
  leftPaw = document.querySelector(".left-paw");
  rightPaw = document.querySelector(".right-paw");
  catCharacter = document.querySelector(".cat-character");
  usernameInput = document.querySelector(".username-input");
  usernameForm = document.querySelector(".username-form");
  messageInput = document.querySelector(".message-input");
  messageForm = document.querySelector(".message-form");
  chatContainer = document.querySelector(".chat-container");
  pseudoHover = document.createElement("span");
  pseudoHover.classList.add("pseudo-hover");
  init();
});

/**
 * Socket.io
 */
const socket = io("https://whispering-chamber-09886.herokuapp.com");

// Emit and Listeners
const init = () => {
  /**
   * Character selection
   */

  leftPaw.addEventListener("click", changeCharacter);
  rightPaw.addEventListener("click", changeCharacter);

  catCharacter.addEventListener("click", (e) => {
    usernameForm.dispatchEvent(new Event("submit"));
  });

  socket.emit("getMessages");
  socket.on("messages", (messages) => {
    messages.forEach((message, index) => {
      let update = false;
      if (messages.length == index + 1) update = true;
      addMessage(message, update);
    });
  });

  socket.emit("getUsers");
  socket.on("users", (users) => {
    users.forEach((user) => addUser(user));
  });

  // socket.on("user", (user) => {
  //   addUser(user);
  // });

  socket.on("userConnection", (user) => {
    if (socket.id == user.id) currentUser = user;
    addUser(user);
  });

  socket.on("userDisconnection", (user) => {
    removeUser(user);
  });

  socket.on("updateUsername", (user) => changeUsername(user));

  socket.on("message", (message) => addMessage(message, true));

  socket.on("updateRole", (user) => {
    // if (user.role.isInterger())
    changeMeshColor(
      usersMeshes.filter((userMesh) => userMesh.userId == user.id)[0],
      colors[user.role]
    );
    console.log(user.role);
  });

  usernameForm.addEventListener("submit", submitUsername);

  messageForm.addEventListener("submit", sendMessage);
};

/**
 * Base
 */
// Canvas
const canvas = document.querySelector("canvas.webgl");

// Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe6e4cf);
scene.fog = new THREE.Fog(new THREE.Color(0xe6e4cf), 1, 10);

/**
 * Sizes
 */
const sizes = {
  width: window.innerWidth,
  height: window.innerHeight,
};

window.addEventListener("resize", () => {
  // Update sizes
  sizes.width = window.innerWidth;
  sizes.height = window.innerHeight;

  effectComposer.setSize(sizes.width, sizes.height);

  // Update camera
  camera.aspect = sizes.width / sizes.height;
  camera.updateProjectionMatrix();

  // Update renderer
  renderer.setSize(sizes.width, sizes.height);
  renderer.setPixelRatio(window.devicePixelRatio);
});

//Objects
const cubeTextureLoader = new THREE.CubeTextureLoader();

const environmentMapTexture = cubeTextureLoader.load([
  "/assets/textures/environmentMaps/0/px.jpg",
  "/assets/textures/environmentMaps/0/nx.jpg",
  "/assets/textures/environmentMaps/0/py.jpg",
  "/assets/textures/environmentMaps/0/ny.jpg",
  "/assets/textures/environmentMaps/0/pz.jpg",
  "/assets/textures/environmentMaps/0/nz.jpg",
]);

const textureLoader = new THREE.TextureLoader();
const normal3 = textureLoader.load("/assets/textures/matcaps/3.png");

const floorMaterial = new THREE.MeshMatcapMaterial({
  color: 0xfffde8,
  matcap: normal3,
  transparent: true,
  opacity: 0.5,
});

const planeGeometry = new THREE.PlaneGeometry(100, 100, 64, 64);
const mirror = new Reflector(planeGeometry, {
  clipBias: 0.003,
  textureWidth: window.innerWidth * window.devicePixelRatio,
  textureHeight: window.innerHeight * window.devicePixelRatio,
  color: 0x777777,
});
mirror.position.y = -0.0001;
mirror.rotation.x = -Math.PI / 2;

const bottomMesh = new THREE.Mesh(planeGeometry, floorMaterial);
bottomMesh.rotation.x = -Math.PI / 2;

scene.add(mirror, bottomMesh);

/**
 * Lights
 */
const pointLight = new THREE.PointLight(0xeeeae2, 1);
pointLight.position.z = 10;
pointLight.position.x = -20;

const pointLight2 = new THREE.PointLight(0xfb8f2b, 2);
pointLight2.position.z = 10;
pointLight2.position.x = 20;

const pointLight3 = new THREE.PointLight(0xeeeae2, 1);
pointLight2.position.z = -10;

scene.add(pointLight);
scene.add(pointLight2);
scene.add(pointLight3);

/**
 * Camera
 */

// Base camera
const camera = new THREE.PerspectiveCamera(
  55,
  sizes.width / sizes.height,
  0.1,
  100
);

camera.position.z = 4;
camera.position.y = 0.7;

scene.add(camera);

/**
 * Renderer
 */

const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
});
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(window.devicePixelRatio);

/**
 * Animate
 */

const mouse = new THREE.Vector2();
const target = new THREE.Vector2();
const raycaster = new THREE.Raycaster();

const realMouse = {
  x: 0,
  y: 0,
};

function onMouseMove(event) {
  realMouse.x = event.clientX;
  realMouse.y = event.clientY;
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
}

/**
 * Post processing
 */
const effectComposer = new EffectComposer(renderer);
effectComposer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
effectComposer.setSize(sizes.width, sizes.height);

const renderPass = new RenderPass(scene, camera);
effectComposer.addPass(renderPass);

const unrealBloomPass = new UnrealBloomPass();
effectComposer.addPass(unrealBloomPass);

unrealBloomPass.strength = 0.125;
unrealBloomPass.radius = 1.23;
unrealBloomPass.threshold = 0.105;

const tick = () => {
  target.x = -mouse.x * 0.3;
  target.y = mouse.y * 0.1;
  camera.rotation.x += 0.03 * (target.y - camera.rotation.x);
  camera.rotation.y += 0.03 * (target.x - camera.rotation.y);

  raycaster.setFromCamera(mouse, camera);

  const intersects = raycaster.intersectObjects(scene.children, true);

  if (intersects.length > 0 && raycasterOn) {
    pseudoHover.style.left = realMouse.x + "px";
    pseudoHover.style.top = realMouse.y + "px";
    if (INTERSECTED != intersects[0].object.parent) {
      if (INTERSECTED) {
        gsap.to(".pseudo-hover", 0.3, {
          opacity: 0,
          transform: "scale(0) translate(-50%, -50%)",
        });
      }

      if (intersects[0].object.parent.username) {
        INTERSECTED = intersects[0].object.parent;
        pseudoHover.textContent = INTERSECTED.username;
        document.querySelector("body").appendChild(pseudoHover);
        gsap.to(".pseudo-hover", 0.3, {
          opacity: 1,
          transform: "scale(1) translate(-50%, -50%)",
        });
      } else {
        INTERSECTED = null;
      }
    }
  } else {
    INTERSECTED = null;
  }

  // Render
  renderer.render(scene, camera);

  effectComposer.render();

  window.requestAnimationFrame(tick);
};

tick();

const changeCharacter = (e) => {
  if (e.target.parentNode == leftPaw && pawPosition > 0) {
    pawPosition--;
    setCurrentCharacter(pawPosition);
  } else if (e.target.parentNode == rightPaw && pawPosition < 5) {
    pawPosition++;
    setCurrentCharacter(pawPosition);
  }
  usernameInput.focus();
};

//Methods
const setCurrentCharacter = (choice) => {
  switch (choice) {
    case 1:
      root.style.setProperty(
        "--accent-gradient",
        "linear-gradient(180.25deg, #FB8F2B 15.18%, #EB6226 67.55%, #D11B1D 99.78%)"
      );
      root.style.setProperty("--first-stop-color", "#FB8F2B");
      root.style.setProperty("--second-stop-color", "#EB6226");
      root.style.setProperty("--third-stop-color", "#D11B1D");
      root.style.setProperty("--secondary-color", "#fff");
      currentColor = 0xd11b1d;
      changeMeshColor(currentUserMesh, currentColor);
      socket.emit("setRole", 1);
      break;
    case 2:
      root.style.setProperty(
        "--accent-gradient",
        "linear-gradient(180deg, #AAFAFF 0%, #75ADFB 100%)"
      );
      root.style.setProperty("--first-stop-color", "#A9F8FF");
      root.style.setProperty("--second-stop-color", "#91d6fd");
      root.style.setProperty("--third-stop-color", "#79B3FB");
      root.style.setProperty("--secondary-color", "#000");
      currentColor = 0x79b3fb;
      changeMeshColor(currentUserMesh, currentColor);
      socket.emit("setRole", 2);
      break;
    case 3:
      root.style.setProperty(
        "--accent-gradient",
        "linear-gradient(180deg, #29E8BA 0%, #265964 100%)"
      );
      root.style.setProperty("--first-stop-color", "#79FFDF");
      root.style.setProperty("--second-stop-color", "#29E8BA");
      root.style.setProperty("--third-stop-color", "#265964");
      root.style.setProperty("--secondary-color", "#fff");
      currentColor = 0x265964;
      changeMeshColor(currentUserMesh, currentColor);
      socket.emit("setRole", 3);
      break;
    case 4:
      root.style.setProperty(
        "--accent-gradient",
        "linear-gradient(180deg, #706DFF 0%, #514EDC 41.15%, #5F309C 100%)"
      );
      root.style.setProperty("--first-stop-color", "#7876D9");
      root.style.setProperty("--second-stop-color", "#7264C9");
      root.style.setProperty("--third-stop-color", "#5F309C");
      root.style.setProperty("--secondary-color", "#000");
      currentColor = 0x5f309c;
      changeMeshColor(currentUserMesh, currentColor);
      socket.emit("setRole", 4);
      break;
    case 5:
      root.style.setProperty(
        "--accent-gradient",
        "linear-gradient(180deg, #D94E3F 0%, #C94746 53.65%, #9F335A 100%)"
      );
      root.style.setProperty("--first-stop-color", "#FCBB8D");
      root.style.setProperty("--second-stop-color", "#D94E3F");
      root.style.setProperty("--third-stop-color", "#9F335A");
      root.style.setProperty("--secondary-color", "#fff");
      currentColor = 0x9f335a;
      changeMeshColor(currentUserMesh, currentColor);
      socket.emit("setRole", 5);
      break;
    default:
      root.style.setProperty(
        "--accent-gradient",
        "  linear-gradient(180deg, #EFEFEF 30.21%, #E1E1E1 60.94%, #C6C6C6 100%)"
      );
      root.style.setProperty("--first-stop-color", "#fff");
      root.style.setProperty("--second-stop-color", "#f6f6f6");
      root.style.setProperty("--third-stop-color", "#dbdbdb");
      root.style.setProperty("--secondary-color", "#000");
      currentColor = 0xdbdbdb;
      changeMeshColor(currentUserMesh, currentColor);
      socket.emit("setRole", 0);
      break;
  }
};

const changeMeshColor = (mesh, color) => {
  const newMaterial = new THREE.MeshStandardMaterial({
    color,
    envMap: environmentMapTexture,
    metalness: 1,
    roughness: 0.5,
    flatShading: false,
  });

  mesh.traverse((o) => {
    console.log(o);
    if (
      o.isMesh &&
      (o.name == "Torus" || o.name == "Sphere006" || o.name == "Sphere005")
    )
      o.material = newMaterial;
  });
};

const sendMessage = (e) => {
  e.preventDefault();
  if (messageInput.value.trim() != "") {
    socket.emit("message", messageInput.value);
    messageInput.value = "";
  }
};

const submitUsername = (e) => {
  e.preventDefault();
  if (usernameInput.value.trim() != "") {
    socket.emit("setUsername", usernameInput.value);
    usernameInput.value = "";
    document.querySelector(".welcome").remove();
    canvas.classList.remove("hide");
    messageForm.classList.remove("hide");
    chatContainer.classList.remove("hide");
    messageInput.focus();
    raycasterOn = true;
    document.addEventListener("mousemove", onMouseMove, false);
  }
};

const addMessage = (message, update) => {
  if (!document.getElementById(message.id) || message.value.length() < 500) {
    messages.push(message);
    let messageElement = document.createElement("li");
    messageElement.id = message.id;
    messageElement.dataset.time = message.time;
    messageElement.classList.add("message");
    if (message.user.id == currentUser.id) messageElement.classList.add("self");

    let usernameElement = document.createElement("span");
    usernameElement.textContent = message.user.name;
    messageElement.appendChild(usernameElement);

    let contentElement = document.createElement("p");
    contentElement.textContent = message.value;
    messageElement.appendChild(contentElement);

    document.querySelector(".chat-container").appendChild(messageElement);
    if (update) updateScroll();
  }
};

const addUser = (user) => {
  if (users.filter((aUser) => aUser.id == user.id).length == 0) {
    users.push(user);
    let userMesh;
    const meshCoordinates = {
      x: 0,
      z: 0,
    };
    if (usersMeshes.length == 0) {
      const gltfLoader = new GLTFLoader();
      const dracoLoader = new DRACOLoader();
      dracoLoader.setDecoderPath("/assets/js/draco/");
      gltfLoader.setDRACOLoader(dracoLoader);

      gltfLoader.load("/assets/3D/chatcollier.gltf", (gltf) => {
        userMesh = gltf.scene;
        userMesh.scale.set(0.08, 0.08, 0.08);

        do {
          meshCoordinates.x = (Math.random() - 0.5) * 5;
          meshCoordinates.z = (Math.random() - 0.5) * 5;
        } while (isToClose(meshCoordinates));
        meshesPositions.push(meshCoordinates);

        userMesh.position.z = meshCoordinates.z;
        userMesh.position.y = (Math.random() - 0.5) * 5;
        userMesh.position.x = meshCoordinates.x;

        userMesh.rotation.y = Math.PI * Math.random();

        gsap.to(userMesh.position, 0.75, {
          y: 0,
          ease: "power3.out",
          stagger: 0.5,
        });

        userMesh.userId = user.id;
        userMesh.username = user.name;
        usersMeshes.push(userMesh);

        if (user.id == currentUser.id) {
          currentUserMesh = userMesh;
          changeMeshColor(userMesh, currentColor);
        } else {
          let color = colors[Math.floor(Math.random() * 6)];
          changeMeshColor(userMesh, color);
          userMesh.userColor = color;
        }
        scene.add(userMesh);
      });
    } else {
      userMesh = usersMeshes[0].clone();
      do {
        meshCoordinates.x = (Math.random() - 0.5) * 5;
        meshCoordinates.z = (Math.random() - 0.5) * 5;
      } while (isToClose(meshCoordinates));
      meshesPositions.push(meshCoordinates);

      userMesh.position.z = meshCoordinates.z;
      userMesh.position.y = (Math.random() - 0.5) * 5;
      userMesh.position.x = meshCoordinates.x;

      userMesh.rotation.y = Math.PI * Math.random();

      gsap.to(userMesh.position, 0.75, {
        y: 0,
        ease: "power3.out",
        stagger: 0.5,
      });

      userMesh.userId = user.id;
      userMesh.username = user.name;
      usersMeshes.push(userMesh);

      if (user.id == currentUser.id) {
        currentUserMesh = userMesh;
        changeMeshColor(userMesh, currentColor);
      } else {
        let color = colors[Math.floor(Math.random() * 6)];
        changeMeshColor(userMesh, color);
        userMesh.userColor = color;
      }
      scene.add(userMesh);
    }
  }
};

const isToClose = (coordinates) => {
  return (
    meshesPositions.filter(
      (meshPositions) =>
        coordinates.x < meshPositions.x + 0.2 &&
        meshPositions.x - 0.2 < coordinates.x &&
        coordinates.z < meshPositions.z + 0.2 &&
        meshPositions.z - 0.2 < coordinates.z
    ).length > 0
  );
};

const removeUser = (user) => {
  console.log(users.length);
  usersMeshes.forEach((userMesh) => {
    if (userMesh.userId == user.id) {
      gsap.to(userMesh.rotation, 0.75, {
        y: Math.PI * 2,
        ease: "power3.out",
      });
      gsap.to(userMesh.scale, 0.75, {
        x: 0,
        y: 0,
        z: 0,
        ease: "power3.out",
        onComplete() {
          scene.remove(userMesh);
        },
      });
    }
  });
  users.splice(users.indexOf(user), 1);
};

const changeUsername = (user) => {
  if (user.name != "") {
    let usersFiltered = users.filter((aUser) => aUser.id == user.id);
    if (usersFiltered.length == 1) usersFiltered[0].name = user.name;

    let usersMeshesFiltered = usersMeshes.filter(
      (aUserMesh) => aUserMesh.userId == user.id
    );
    if (usersMeshesFiltered.length == 1)
      usersMeshesFiltered[0].username = user.name;
  }
};

const updateScroll = () => {
  gsap.to(chatContainer, 1, {
    scrollTop: chatContainer.scrollHeight,
    ease: "power3.inout",
  });
};
