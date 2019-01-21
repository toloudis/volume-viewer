import {
    AICSview3d,
    AICSvolumeDrawable,
    AICSmakeVolumes,
    AICSvolumeLoader,
    Light,
    AREA_LIGHT,
    SKY_LIGHT
} from '../src';

let el = document.getElementById("volume-viewer");
//let view3D = new AICSview3d_PT(el);
let view3D = new AICSview3d(el);

// TODO FIX ME : run this code after we know that the page has rendered, 
// so that the view3D can get size from el
view3D.resize(null, 1032, 915);

const dataset = {
    prefixdir: "april/",
    stages: ["M1", "M2", "M3", "M4", "M5", "M6", "M7"],
    names: ["ACTB", "ACTN1", "CENT2", "DSP", "FBL", "LAMP1", "LMNB1", "MYH10", "PMP34", "SEC61B", "ST6GAL1", "TJP1", "TOMM20", "TUBA1B"],
    types: ["raw", "seg"]
};
function make_name(stage, name, type) {
    return name + "_" + stage + "_" + type + "_atlas.json";
}

const myState = {
    file: "",
    density: 50.0,
    maskAlpha: 1.0,
    exposure: 0.75,
    aperture: 0.0,
    fov: 20,
    focal_distance: 4.0,

    lights: [new Light(SKY_LIGHT), new Light(AREA_LIGHT)],

    skyTopIntensity: 0.5,
    skyMidIntensity: 1.25,
    skyBotIntensity: 0.5,
    skyTopColor: [255, 255, 255],
    skyMidColor: [255, 255, 255],
    skyBotColor: [255, 255, 255],

    lightColor: [255, 255, 255],
    lightIntensity: 50.0,
    lightTheta: 0.0,
    lightPhi: 0.0,

    xmin: 0.0,
    ymin: 0.0,
    zmin: 0.0,
    xmax: 1.0,
    ymax: 1.0,
    zmax: 1.0
};
let gui = null;

function setupGui() {

    gui = new dat.GUI();
    //gui = new dat.GUI({autoPlace:false, width:200});

    gui.add(myState, "density").max(100.0).min(0.0).step(0.001).onChange(function (value) {
        view3D.updateDensity(value);
    });
    gui.add(myState, "maskAlpha").max(1.0).min(0.0).step(0.001).onChange(function (value) {
        view3D.image.setMaskAlpha(value);
    });

    var cameragui = gui.addFolder("Camera");
    cameragui.add(myState, "exposure").max(1.0).min(0.0).step(0.001).onChange(function (value) {
        view3D.updateExposure(value);
    });
    cameragui.add(myState, "aperture").max(0.1).min(0.0).step(0.001).onChange(function (value) {
        view3D.updateCamera(myState.fov, myState.focal_distance, myState.aperture);
    });
    cameragui.add(myState, "focal_distance").max(5.0).min(0.1).step(0.001).onChange(function (value) {
        view3D.updateCamera(myState.fov, myState.focal_distance, myState.aperture);
    });
    cameragui.add(myState, "fov").max(90.0).min(0.0).step(0.001).onChange(function (value) {
        view3D.updateCamera(myState.fov, myState.focal_distance, myState.aperture);
    });

    var clipping = gui.addFolder("Clipping Box");
    clipping.add(myState, "xmin").max(1.0).min(0.0).step(0.001).onChange(function (value) {
        view3D.updateClipRegion(myState.xmin, myState.xmax, myState.ymin, myState.ymax, myState.zmin, myState.zmax);
    });
    clipping.add(myState, "xmax").max(1.0).min(0.0).step(0.001).onChange(function (value) {
        view3D.updateClipRegion(myState.xmin, myState.xmax, myState.ymin, myState.ymax, myState.zmin, myState.zmax);
    });
    clipping.add(myState, "ymin").max(1.0).min(0.0).step(0.001).onChange(function (value) {
        view3D.updateClipRegion(myState.xmin, myState.xmax, myState.ymin, myState.ymax, myState.zmin, myState.zmax);
    });
    clipping.add(myState, "ymax").max(1.0).min(0.0).step(0.001).onChange(function (value) {
        view3D.updateClipRegion(myState.xmin, myState.xmax, myState.ymin, myState.ymax, myState.zmin, myState.zmax);
    });
    clipping.add(myState, "zmin").max(1.0).min(0.0).step(0.001).onChange(function (value) {
        view3D.updateClipRegion(myState.xmin, myState.xmax, myState.ymin, myState.ymax, myState.zmin, myState.zmax);
    });
    clipping.add(myState, "zmax").max(1.0).min(0.0).step(0.001).onChange(function (value) {
        view3D.updateClipRegion(myState.xmin, myState.xmax, myState.ymin, myState.ymax, myState.zmin, myState.zmax);
    });

    var lighting = gui.addFolder("Lighting");
    lighting.addColor(myState, "skyTopColor").name("Sky Top").onChange(function (value) {
        myState.lights[0].m_colorTop = new THREE.Vector3(
            myState.skyTopColor[0]/255.0*myState.skyTopIntensity,
            myState.skyTopColor[1]/255.0*myState.skyTopIntensity,
            myState.skyTopColor[2]/255.0*myState.skyTopIntensity
        );
        view3D.updateLights(myState.lights);
    });
    lighting.add(myState, "skyTopIntensity").max(100.0).min(0.01).step(0.1).onChange(function (value) {
        myState.lights[0].m_colorTop = new THREE.Vector3(
            myState.skyTopColor[0]/255.0*myState.skyTopIntensity,
            myState.skyTopColor[1]/255.0*myState.skyTopIntensity,
            myState.skyTopColor[2]/255.0*myState.skyTopIntensity
        );
        view3D.updateLights(myState.lights);
    });
    lighting.addColor(myState, "skyMidColor").name("Sky Mid").onChange(function (value) {
        myState.lights[0].m_colorMiddle = new THREE.Vector3(
            myState.skyMidColor[0]/255.0*myState.skyMidIntensity,
            myState.skyMidColor[1]/255.0*myState.skyMidIntensity,
            myState.skyMidColor[2]/255.0*myState.skyMidIntensity
        );
        view3D.updateLights(myState.lights);
    });
    lighting.add(myState, "skyMidIntensity").max(100.0).min(0.01).step(0.1).onChange(function (value) {
        myState.lights[0].m_colorMiddle = new THREE.Vector3(
            myState.skyMidColor[0]/255.0*myState.skyMidIntensity,
            myState.skyMidColor[1]/255.0*myState.skyMidIntensity,
            myState.skyMidColor[2]/255.0*myState.skyMidIntensity
        );
        view3D.updateLights(myState.lights);
    });
    lighting.addColor(myState, "skyBotColor").name("Sky Bottom").onChange(function (value) {
        myState.lights[0].m_colorBottom = new THREE.Vector3(
            myState.skyBotColor[0]/255.0*myState.skyBotIntensity,
            myState.skyBotColor[1]/255.0*myState.skyBotIntensity,
            myState.skyBotColor[2]/255.0*myState.skyBotIntensity
        );
        view3D.updateLights(myState.lights);
    });
    lighting.add(myState, "skyBotIntensity").max(100.0).min(0.01).step(0.1).onChange(function (value) {
        myState.lights[0].m_colorBottom = new THREE.Vector3(
            myState.skyBotColor[0]/255.0*myState.skyBotIntensity,
            myState.skyBotColor[1]/255.0*myState.skyBotIntensity,
            myState.skyBotColor[2]/255.0*myState.skyBotIntensity
        );
        view3D.updateLights(myState.lights);
    });
    lighting.add(myState.lights[1], "m_distance").max(10.0).min(0.0).step(0.1).onChange(function (value) {
        view3D.updateLights(myState.lights);
    });
    lighting.add(myState, "lightTheta").max(180.0).min(-180.0).step(1).onChange(function (value) {
        myState.lights[1].m_theta = value * 3.14159265 / 180.0;
        view3D.updateLights(myState.lights);
    });
    lighting.add(myState, "lightPhi").max(180.0).min(0.0).step(1).onChange(function (value) {
        myState.lights[1].m_phi = value * 3.14159265 / 180.0;
        view3D.updateLights(myState.lights);
    });
    lighting.add(myState.lights[1], "m_width").max(100.0).min(0.01).step(0.1).onChange(function (value) {
        myState.lights[1].m_width = value;
        myState.lights[1].m_height = value;
        view3D.updateLights(myState.lights);
    });
    lighting.add(myState, "lightIntensity").max(1000.0).min(0.01).step(0.1).onChange(function (value) {
        myState.lights[1].m_color = new THREE.Vector3(
            myState.lightColor[0]/255.0*myState.lightIntensity,
            myState.lightColor[1]/255.0*myState.lightIntensity,
            myState.lightColor[2]/255.0*myState.lightIntensity
        );
        view3D.updateLights(myState.lights);
    });
    lighting.addColor(myState, "lightColor").name("lightcolor").onChange(function (value) {
        myState.lights[1].m_color = new THREE.Vector3(
            myState.lightColor[0]/255.0*myState.lightIntensity,
            myState.lightColor[1]/255.0*myState.lightIntensity,
            myState.lightColor[2]/255.0*myState.lightIntensity
        );
        view3D.updateLights(myState.lights);
    });

}

dat.GUI.prototype.removeFolder = function (name) {
    var folder = this.__folders[name];
    if (!folder) {
        return;
    }
    folder.close();
    this.__ul.removeChild(folder.domElement.parentNode);
    delete this.__folders[name];
    this.onResize();
}

function showChannelUI(img) {

    if (myState && myState.channelFolderNames) {
        for (var i = 0; i < myState.channelFolderNames.length; ++i) {
            gui.removeFolder(myState.channelFolderNames[i]);
        }
    }
    
    myState.infoObj = img.volume.imageInfo;

    myState.infoObj.channelGui = [];
    const initcolors = [
        [255, 0, 255],
        [0, 255, 255],
        [255, 255, 255]
    ];
    const initlevels = [
        [0.5, 0.5],
        [0.5, 0.8],
        [0.5, 0.8]
    ]
    myState.channelFolderNames = []
    for (var i = 0; i < myState.infoObj.channels; ++i) {
        myState.infoObj.channelGui.push({
            colorD: (i < 3) ? initcolors[i] : [255, 255, 255],
            colorS: [0, 0, 0],
            colorE: [0, 0, 0],
            window: initlevels[i][0],
            level: initlevels[i][1],
            roughness: 0.0,
            enabled: true,
            // this doesn't give good results currently but is an example of a per-channel button callback
            autoIJ: (function(j) {
                return function() {
                    view3D.image.volume.channels[j].lutGenerator_auto2();
                    view3D.updateLuts();
                }
            })(i)
        });
        var f = gui.addFolder("Channel " + myState.infoObj.channel_names[i]);
        myState.channelFolderNames.push("Channel " + myState.infoObj.channel_names[i]);
        f.add(myState.infoObj.channelGui[i], "enabled").onChange(function (j) {
            return function (value) {
                view3D.image.setVolumeChannelEnabled(j, value ? true : false);
                view3D.updateActiveChannels();
            };
        }(i));
        f.addColor(myState.infoObj.channelGui[i], "colorD").name("Diffuse").onChange(function (j) {
            return function (value) {
                view3D.image.updateChannelMaterial(
                    j,
                    myState.infoObj.channelGui[j].colorD,
                    myState.infoObj.channelGui[j].colorS,
                    myState.infoObj.channelGui[j].colorE,
                    myState.infoObj.channelGui[j].roughness
                );
                view3D.updateMaterial();
            };
        }(i));
        f.addColor(myState.infoObj.channelGui[i], "colorS").name("Specular").onChange(function (j) {
            return function (value) {
                view3D.image.updateChannelMaterial(
                    j,
                    myState.infoObj.channelGui[j].colorD,
                    myState.infoObj.channelGui[j].colorS,
                    myState.infoObj.channelGui[j].colorE,
                    myState.infoObj.channelGui[j].roughness
                );
                view3D.updateMaterial();
            };
        }(i));
        f.addColor(myState.infoObj.channelGui[i], "colorE").name("Emissive").onChange(function (j) {
            return function (value) {
                view3D.image.updateChannelMaterial(
                    j,
                    myState.infoObj.channelGui[j].colorD,
                    myState.infoObj.channelGui[j].colorS,
                    myState.infoObj.channelGui[j].colorE,
                    myState.infoObj.channelGui[j].roughness
                );
                view3D.updateMaterial();
            };
        }(i));
        f.add(myState.infoObj.channelGui[i], "window").max(1.0).min(0.0).step(0.001).onChange(function (j) {
                return function (value) {
                    view3D.image.volume.channels[j].lutGenerator_windowLevel(value, myState.infoObj.channelGui[j].level);
                    view3D.updateLuts();
                }
            }(i));

        f.add(myState.infoObj.channelGui[i], "level").max(1.0).min(0.0).step(0.001).onChange(function (j) {
                return function (value) {
                    view3D.image.volume.channels[j].lutGenerator_windowLevel(myState.infoObj.channelGui[j].window, value);
                    view3D.updateLuts();
                }
            }(i));
        //f.add(myState.infoObj.channelGui[i], 'autoIJ');
        f.add(myState.infoObj.channelGui[i], "roughness").max(100.0).min(0.0).onChange(function (j) {
                return function (value) {
                    view3D.image.updateChannelMaterial(
                        j,
                        myState.infoObj.channelGui[j].colorD,
                        myState.infoObj.channelGui[j].colorS,
                        myState.infoObj.channelGui[j].colorE,
                        myState.infoObj.channelGui[j].roughness
                    );
                    view3D.updateMaterial();
                }
            }(i));

    }

}

function loadImageData(jsondata, volumedata) {

    // PRESET
    jsondata.pixel_size_x = 1.0;
    jsondata.pixel_size_y = 1.0;
    jsondata.pixel_size_z = 2.9;
    if (rawselecter.value === "seg") {
        jsondata.channel_colors = [
            [50, 0, 50],
            [0, 255, 255],
            [255, 255, 255]
        ];
    }
    else {
        jsondata.channel_colors = [
            [128, 0, 128],
            [0, 255, 255],
            [255, 255, 255]
        ];
    }


    const aimg = new AICSvolumeDrawable(jsondata, isPT);

    // get data into the image
    if (volumedata) {
        for (var i = 0; i < volumedata.length; ++i) {
            // where each volumedata element is a flat Uint8Array of xyz data
            // according to jsondata.tile_width*jsondata.tile_height*jsondata.tiles
            // (first row of first plane is the first data in 
            // the layout, then second row of first plane, etc)
            aimg.setChannelDataFromVolume(i, volumedata[i]);
        }
    }
    else {
        AICSvolumeLoader.loadVolumeAtlasData(jsondata.images, (url, channelIndex, atlasdata, atlaswidth, atlasheight) => {
            // 0 is membrane
            if (channelIndex === 0) {
                if (rawselecter.value === "seg") {
                    aimg.setVolumeChannelEnabled(channelIndex, false);
                }
                else {
                }
            }
            else if (channelIndex === 1) {
            }
            else if (channelIndex === 2) {
            }

            aimg.setChannelDataFromAtlas(channelIndex, atlasdata, atlaswidth, atlasheight);

            if (rawselecter.value === "seg") {
                aimg.volume.channels[channelIndex].lutGenerator_windowLevel(1.0, 0.5);
            }
            else{
                aimg.volume.channels[channelIndex].lutGenerator_auto2();
            }

            if (aimg.volume.loaded) {
                // tell the viewer about the image
                view3D.setImage(aimg);

                view3D.updateActiveChannels();
                //aimg.setChannelAsMask(5);
                //aimg.setMaskAlpha(1.0);
                view3D.updateLuts();
                view3D.updateLights(myState.lights);
            }

        });
    }

    showChannelUI(aimg);

    //view3D.setCameraMode('3D');
    if (rawselecter.value === "seg") {
        aimg.setDensity(1);
        //aimg.setDensity(0.32);
    }
    else {
        aimg.setDensity(0.1);
    }
    aimg.setBrightness(0.8);
}

var xbtn = document.getElementById("X");
xbtn.addEventListener("click", ()=>{view3D.setCameraMode('X');});
var ybtn = document.getElementById("Y");
ybtn.addEventListener("click", ()=>{view3D.setCameraMode('Y');});
var zbtn = document.getElementById("Z");
zbtn.addEventListener("click", ()=>{view3D.setCameraMode('Z');});
var d3btn = document.getElementById("3D");
d3btn.addEventListener("click", ()=>{view3D.setCameraMode('3D');});
var isRot = false;
var rotbtn = document.getElementById("rotbtn");
rotbtn.addEventListener("click", ()=>{isRot = !isRot; view3D.setAutoRotate(isRot)});
var isAxis = false;
var axisbtn = document.getElementById("axisbtn");
axisbtn.addEventListener("click", ()=>{isAxis = !isAxis; view3D.setShowAxis(isAxis)});
var isPT = false;
if (view3D.canvas3d.hasWebGL2) {
    var ptbtn = document.createElement("button");
    ptbtn.setAttribute("id", "ptbtn");
    var t = document.createTextNode("Pathtrace");
    ptbtn.appendChild(t);

    //var ptbtn = document.getElementById("ptbtn");
    ptbtn.addEventListener("click", ()=>{
        isPT = !isPT; 
        view3D.setPathTrace(isPT);
        view3D.updateLights(myState.lights);
    });

    axisbtn.parentNode.insertBefore(ptbtn, axisbtn.nextSibling);
}

setupGui();

// switch the uncommented line to test with volume data or atlas data
var stageselecter = document.getElementById("phaseselecter");
var structureselecter = document.getElementById("structureselecter");
var rawselecter = document.getElementById("rawselecter");

function loadnewcell(stage, structure, raw) {
    const url = make_name(stage, structure, raw);
    fetch(dataset.prefixdir+url)
    .then(function(response) {
      return response.json();
    })
    .then(function(myJson) {
        if (view3D.volumeTexture) {
            view3D.volumeTexture.dispose();
            view3D.volumeTexture = null;
        }
        // prefix all the names in myJson.images
        myJson.images.forEach(function(element) {
            element.name = dataset.prefixdir + element.name;
        });        
        loadImageData(myJson);
    });
}

// initial cell
loadnewcell(stageselecter.value, structureselecter.value, rawselecter.value);


// arrow key implementation
let selected_name = 0;
let selected_stage = 0;
let selected_seg = 0;
document.addEventListener('keydown', function(event) {
    if (event.code == 'ArrowDown') {
        selected_name = (selected_name + dataset.names.length + 1) % dataset.names.length;
        structureselecter.value=dataset.names[selected_name];
    }
    if (event.code == 'ArrowUp') {
        selected_name = (selected_name + dataset.names.length - 1) % dataset.names.length;
        structureselecter.value=dataset.names[selected_name];
    }
    if (event.code == 'ArrowLeft') {
        selected_stage = (selected_stage + dataset.stages.length - 1) % dataset.stages.length;
        stageselecter.value=dataset.stages[selected_stage];
    }
    if (event.code == 'ArrowRight') {
        selected_stage = (selected_stage + dataset.stages.length + 1) % dataset.stages.length;
        stageselecter.value=dataset.stages[selected_stage];
    }
    if (event.code == 'KeyS') {
        selected_seg = 1 - selected_seg;
        rawselecter.value = dataset.types[selected_seg];
    }
    loadnewcell(stageselecter.value, structureselecter.value, rawselecter.value);
});

// combo box implementation
stageselecter.addEventListener("change", (e)=> {
    loadnewcell(stageselecter.value, structureselecter.value, rawselecter.value);
    selected_stage = dataset.stages.indexOf(stageselecter.value);
    stageselecter.blur();
});
structureselecter.addEventListener("change", (e)=> {
    loadnewcell(stageselecter.value, structureselecter.value, rawselecter.value);
    selected_name = dataset.names.indexOf(structureselecter.value);
    structureselecter.blur();
});
rawselecter.addEventListener("change", (e)=> {
    loadnewcell(stageselecter.value, structureselecter.value, rawselecter.value);
    selected_seg = dataset.types.indexOf(rawselecter.value);
    rawselecter.blur();
});

