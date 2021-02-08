import * as THREE from './node_modules/three/build/three.module.js';

import { OBJLoader } from './node_modules/three/examples/jsm/loaders/OBJLoader.js';

import Stats from './node_modules/three/examples/jsm/libs/stats.module.js';
import { GUI } from './node_modules/three/examples/jsm/libs/dat.gui.module.js';

import { OrbitControls } from './node_modules/three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from './node_modules/three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from './node_modules/three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from './node_modules/three/examples/jsm/postprocessing/ShaderPass.js';
import { OutlinePass } from './node_modules/three/examples/jsm/postprocessing/OutlinePass.js';
import { FXAAShader } from './node_modules/three/examples/jsm/shaders/FXAAShader.js';

let container, stats;
let camera, scene, renderer, controls;
let composer, effectFXAA, outlinePass;

let selectedObjects = [];

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

const obj3d = new THREE.Object3D();
const group = new THREE.Group();

// Global하게 사용할 파라미터의 값을 저장합니다.
const params = {
	rotate: false,
	usePatternTexture: false,
	color: 0xffffff,
	specular: 0x111111,
	shininess: 5,
	emissive: 0x111111
};

// 사용될 DAT GUI를 선언합니다.
const gui = new GUI( { width: 300 } );

gui.add( params, 'rotate' );

// 모든 메쉬에 공통적으로 적용될 Material 선언
const phongMaterial = new THREE.MeshPhongMaterial( { color: 0xffffff, specular: 0x111111, emissive: 0x111111 ,shininess: 5 } );
// GUI에 추가될 Material Info 관련 폴더 생성
const materialInfo = gui.addFolder( 'Material' );
// Model Color
materialInfo.addColor(params, 'color')
.name('Model Color')
.onChange(function() {
	phongMaterial.color.set(params.color);
});
// Specular Color
materialInfo.addColor(params, 'specular')
.name('Specular Color')
.onChange(function() {
	phongMaterial.specular.set(params.specular);
});
// Emissive Color
materialInfo.addColor(params, 'emissive')
.name('Emissive Color')
.onChange(function() {
	phongMaterial.emissive.set(params.emissive);
});
// Shininess
materialInfo.add(params, 'shininess', 0, 100, 0.1)
.name('Shininess')
.onChange(function(){
	phongMaterial.shininess = params.shininess;
	});

init();
animate();

function init() {

	container = document.createElement( 'div' );
	document.body.appendChild( container );

	const width = window.innerWidth;
	const height = window.innerHeight;

	renderer = new THREE.WebGLRenderer();
	renderer.shadowMap.enabled = true;
	// todo - support pixelRatio in this demo
	renderer.setSize( width, height );
	document.body.appendChild( renderer.domElement );

	scene = new THREE.Scene();

	// 뷰어에서의 카메라를 정의하는 부분입니다.

	camera = new THREE.PerspectiveCamera( 45, width / height, 1, 2000 );
	camera.position.z = 250;

	controls = new OrbitControls( camera, renderer.domElement );
	controls.minDistance = 5;
	controls.maxDistance = 50;
	controls.enablePan = false;
	controls.enableDamping = true;
	controls.dampingFactor = 0.05;

	// 뷰어에서의 조명을 정의하는 부분입니다.

	scene.add( new THREE.AmbientLight( 0xaaaaaa, 0.2 ) );

	const light = new THREE.DirectionalLight( 0xddffdd, 0.6 );
	light.position.set( 1, 1, 1 );
	light.castShadow = true;
	light.shadow.mapSize.width = 1024;
	light.shadow.mapSize.height = 1024;

	const d = 10;

	light.shadow.camera.left = - d;
	light.shadow.camera.right = d;
	light.shadow.camera.top = d;
	light.shadow.camera.bottom = - d;
	light.shadow.camera.far = 1000;

	scene.add( light );

	// model 로딩정보를 나타내는 부분입니다.

	const manager = new THREE.LoadingManager();

	manager.onProgress = function ( item, loaded, total ) {

		console.log( item, loaded, total );

	};

	const loader = new OBJLoader( manager );
	loader.load( './object1.obj', function ( object ) {
		var meshInfo = gui.addFolder('Mesh Info');
		// Mesh 별 연산
		object.traverse( function ( child ) {
			if ( child.isMesh ) {
				child.geometry.computeBoundingSphere();
				child.material = phongMaterial;
				child.receiveShadow = true;
				child.castShadow = true;
				meshInfo.add(child, 'visible').name(child.name); // 각 메쉬별 visibility가 들어간 메뉴를 GUI에 추가
			}
		} );
		// 초기에 크기가 너무 크게 잡혀서, 미리 scale을 나눠줍니다.
		object.scale.divideScalar(50);
		// Transformation 관련한 폴더들 생성 및 parameter GUI에 추가
		var transf = gui.addFolder('Transform'); // 평행이동
		transf.add(object.position, "x", -200, 200, 0.1);
		transf.add(object.position, "y", -200, 200, 0.1);
		transf.add(object.position, "z", -200, 200, 0.1);
		var rotate = gui.addFolder('Rotation'); // 회전이동
		rotate.add(object.rotation, "x", 0, Math.PI * 2, 0.01);
		rotate.add(object.rotation, "y", 0, Math.PI * 2, 0.01);
		rotate.add(object.rotation, "z", 0, Math.PI * 2, 0.01);
		var scalefolder = gui.addFolder('Scale'); // 비율변환
		scalefolder.add(object.scale, "x", 0.01, 0.5, 0.01);
		scalefolder.add(object.scale, "y", 0.01, 0.5, 0.01);
		scalefolder.add(object.scale, "z", 0.01, 0.5, 0.01);
		// todo: scale lock 추가
		transf.open();
		rotate.open();
		scalefolder.open();

		obj3d.add( object );

	} );
	scene.add( group );
	group.add( obj3d );


	stats = new Stats();
	container.appendChild( stats.dom );

	// 그림자, 테두리, 텍스쳐 등을 로딩하는 부분입니다.
	composer = new EffectComposer( renderer );

	const renderPass = new RenderPass( scene, camera );
	composer.addPass( renderPass );

	outlinePass = new OutlinePass( new THREE.Vector2( window.innerWidth, window.innerHeight ), scene, camera );
	composer.addPass( outlinePass );

	effectFXAA = new ShaderPass( FXAAShader );
	effectFXAA.uniforms[ 'resolution' ].value.set( 1 / window.innerWidth, 1 / window.innerHeight );
	composer.addPass( effectFXAA );

	// Resize eventlistener를 추가하여 브라우저 리사이징에 대한 이벤트를 등록합니다.
	window.addEventListener( 'resize', onWindowResize );
}

// Browser 리사이징 상황에서의 액션
function onWindowResize() {

	const width = window.innerWidth;
	const height = window.innerHeight;

	camera.aspect = width / height;
	camera.updateProjectionMatrix();

	renderer.setSize( width, height );
	composer.setSize( width, height );

	effectFXAA.uniforms[ 'resolution' ].value.set( 1 / window.innerWidth, 1 / window.innerHeight );

}

// Rotate를 켜놨을 때, 회전과 렌더를 하는 function입니다.
function animate() {

	requestAnimationFrame( animate );

	stats.begin();

	const timer = performance.now();

	if ( params.rotate ) {

		group.rotation.y = timer * 0.0001;

	}

	controls.update();

	composer.render();

	stats.end();

}