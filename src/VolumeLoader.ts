import Volume, { ImageInfo } from "./Volume";
import { openArray, openGroup, HTTPStore, array } from "zarr";
import GeoTIFF, { fromUrl } from "geotiff";

type TypedArray = ArrayLike<any> & {
  BYTES_PER_ELEMENT: number;
  set(array: ArrayLike<number>, offset?: number): void;
  slice(start?: number, end?: number): TypedArray;
};

/**
 * @callback PerChannelCallback
 * @param {string} imageurl
 * @param {Volume} volume
 * @param {number} channelindex
 */
type PerChannelCallback = (imageurl: string, volume: Volume, channelIndex: number) => void;

interface PackedChannelsImage {
  name: string;
  channels: number[];
}
type PackedChannelsImageRequests = Record<string, HTMLImageElement>;

/**
 * @class
 */
export default class VolumeLoader {
  /**
   * load per-channel volume data from a batch of image files containing the volume slices tiled across the images
   * @param {Volume} volume
   * @param {Array.<{name:string, channels:Array.<number>}>} imageArray
   * @param {PerChannelCallback} callback Per-channel callback.  Called when each channel's atlased volume data is loaded
   * @returns {Object.<string, Image>} a map(imageurl : Image object) that should be used to cancel the download requests,
   * for example if you need to destroy the image before all data has arrived.
   * as requests arrive, the callback will be called per image, not per channel
   * @example loadVolumeAtlasData([{
   *     "name": "AICS-10_5_5.ome.tif_atlas_0.png",
   *     "channels": [0, 1, 2]
   * }, {
   *     "name": "AICS-10_5_5.ome.tif_atlas_1.png",
   *     "channels": [3, 4, 5]
   * }, {
   *     "name": "AICS-10_5_5.ome.tif_atlas_2.png",
   *     "channels": [6, 7, 8]
   * }], mycallback);
   */
  static loadVolumeAtlasData(
    volume: Volume,
    imageArray: PackedChannelsImage[],
    callback: PerChannelCallback
  ): PackedChannelsImageRequests {
    const numImages = imageArray.length;

    const requests = {};
    //console.log("BEGIN DOWNLOAD DATA");
    for (let i = 0; i < numImages; ++i) {
      const url = imageArray[i].name;
      const batch = imageArray[i].channels;

      // using Image is just a trick to download the bits as a png.
      // the Image will never be used again.
      const img: HTMLImageElement = new Image();
      img.onerror = function () {
        console.log("ERROR LOADING " + url);
      };
      img.onload = (function (thisbatch) {
        return function (event: Event) {
          //console.log("GOT ch " + me.src);
          // extract pixels by drawing to canvas
          const canvas = document.createElement("canvas");
          // nice thing about this is i could downsample here
          const w = Math.floor((event?.target as HTMLImageElement).naturalWidth);
          const h = Math.floor((event?.target as HTMLImageElement).naturalHeight);
          canvas.setAttribute("width", "" + w);
          canvas.setAttribute("height", "" + h);
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            console.log("Error creating canvas 2d context for " + url);
            return;
          }
          ctx.globalCompositeOperation = "copy";
          ctx.globalAlpha = 1.0;
          ctx.drawImage(event?.target as CanvasImageSource, 0, 0, w, h);
          // getImageData returns rgba.
          // optimize: collapse rgba to single channel arrays
          const iData = ctx.getImageData(0, 0, w, h);

          const channelsBits: Uint8Array[] = [];
          // allocate channels in batch
          for (let ch = 0; ch < Math.min(thisbatch.length, 4); ++ch) {
            channelsBits.push(new Uint8Array(w * h));
          }
          // extract the data
          for (let j = 0; j < Math.min(thisbatch.length, 4); ++j) {
            for (let px = 0; px < w * h; px++) {
              channelsBits[j][px] = iData.data[px * 4 + j];
            }
          }

          // done with img, iData, and canvas now.

          for (let ch = 0; ch < Math.min(thisbatch.length, 4); ++ch) {
            volume.setChannelDataFromAtlas(thisbatch[ch], channelsBits[ch], w, h);
            callback(url, volume, thisbatch[ch]);
          }
        };
      })(batch);
      img.crossOrigin = "Anonymous";
      img.src = url;
      requests[url] = img;
    }

    return requests;
  }

  // loadVolumeAICS(url:string, callback:PerChannelCallback) : Promise<Volume> {
  //   // note that volume is returned before channel data is ready.
  //   return fetch(url)
  //     .then(function(response) {
  //       return response.json();
  //     })
  //     .then(function(myJson) {
  //       // if you need to adjust image paths prior to download,
  //       // now is the time to do it:
  //       // myJson.images.forEach(function(element) {
  //       //     element.name = myURLprefix + element.name;
  //       // });
  //       const vol = new Volume(myJson);

  //       volumeLoader.loadVolumeAtlasData(
  //         vol, myJson.images, callback);
  //       return vol;
  //     });
  // },

  /**
   * load 5d ome-zarr into Volume object
   * @param {string} url
   * @param {PerChannelCallback} callback Per-channel callback.  Called when each channel's atlased volume data is loaded
   * @returns {Promise<Volume>}
   */
  static async loadZarr(urlStore: string, imageName: string, t: number, callback: PerChannelCallback): Promise<Volume> {
    const store = new HTTPStore(urlStore);

    const imagegroup = imageName;

    const data = await openGroup(store, imagegroup, "r");

    // get top-level metadata for this zarr image
    const allmetadata = await data.attrs.asObject();
    //const numlevels = allmetadata.multiscales[0].datasets.length;
    // get raw scaling for level 0
    // each entry of multiscales is a multiscale image.
    const imageIndex = 0;
    // there is one dataset for each multiscale level.
    const dataset0 = allmetadata.multiscales[imageIndex].datasets[0];
    // technically there can be any number of coordinateTransformations
    // but there must be only one of type "scale".
    // Here I assume that is the only one.
    const scale5d = dataset0.coordinateTransformations[0].scale;

    // TODO get metadata sizes for each level?  how inefficient is that?
    // update levelToLoad after we get size info about multiscales?

    const metadata = allmetadata.omero;

    const level0 = await openArray({ store: store, path: imagegroup + "/" + dataset0.path, mode: "r" });
    // full res info
    const w = level0.meta.shape[4];
    const h = level0.meta.shape[3];
    const z = level0.meta.shape[2];
    const c = level0.meta.shape[1];
    const sizeT = level0.meta.shape[0];
    console.log(`X=${w}, Y=${h}, Z=${z}, C=${c}, T=${sizeT}`);

    // making a choice of a reduced level:
    const downsampleZ = 2; // half the z
    const levelToLoad = 1;
    const dataset2 = allmetadata.multiscales[imageIndex].datasets[levelToLoad];
    const level = await openArray({ store: store, path: imagegroup + "/" + dataset2.path, mode: "r" });

    // reduced level info
    const tw = level.meta.shape[4];
    const th = level.meta.shape[3];

    // compute rows and cols and atlas width and ht, given tw and th
    const loadedZ = Math.ceil(z / downsampleZ);
    let nextrows = 1;
    let nextcols = loadedZ;
    let ratio = (nextcols * tw) / (nextrows * th);
    let nrows = nextrows;
    let ncols = nextcols;
    while (ratio > 1) {
      nrows = nextrows;
      ncols = nextcols;
      nextcols -= 1;
      nextrows = Math.ceil(z / nextcols);
      ratio = (nextcols * tw) / (nextrows * th);
    }
    const atlaswidth = ncols * tw;
    const atlasheight = nrows * th;
    console.log(atlaswidth, atlasheight);

    const chnames: string[] = [];
    for (let i = 0; i < metadata.channels.length; ++i) {
      chnames.push(metadata.channels[i].label);
    }
    const imgdata: ImageInfo = {
      width: w,
      height: h,
      channels: c,
      channel_names: chnames,
      rows: nrows,
      cols: ncols,
      tiles: loadedZ,
      tile_width: tw,
      tile_height: th,
      // for webgl reasons, it is best for atlas_width and atlas_height to be <= 2048
      // and ideally a power of 2.  This generally implies downsampling the original volume data for display in this viewer.
      atlas_width: atlaswidth,
      atlas_height: atlasheight,
      pixel_size_x: scale5d[4],
      pixel_size_y: scale5d[3],
      pixel_size_z: scale5d[2] * downsampleZ,
      name: metadata.name,
      version: metadata.version,
      transform: {
        translation: [0, 0, 0],
        rotation: [0, 0, 0],
      },
      times: sizeT,
    };

    // got some data, now let's construct the volume.
    const vol = new Volume(imgdata);

    const storepath = imagegroup + "/" + dataset2.path;
    // do each channel on a worker
    for (let i = 0; i < c; ++i) {
      const worker = new Worker(new URL("./workers/FetchZarrWorker.ts", import.meta.url));
      worker.onmessage = function (e) {
        const u8 = e.data.data;
        const channel = e.data.channel;
        console.log("begin setchannel and callback");
        vol.setChannelDataFromVolume(channel, u8);
        if (callback) {
          // make up a unique name? or have caller pass this in?
          callback(urlStore + "/" + imageName, vol, channel);
        }
        console.log("end setchannel and callback");
        worker.terminate();
      };
      worker.onerror = function (e) {
        alert("Error: Line " + e.lineno + " in " + e.filename + ": " + e.message);
      };
      worker.postMessage({
        urlStore: urlStore,
        time: Math.min(t, sizeT),
        channel: i,
        downsampleZ: downsampleZ,
        path: storepath,
      });
    }

    return vol;
  }

  static async loadOpenCell(callback: PerChannelCallback): Promise<Volume> {
    const numChannels = 2;

    // HQTILE or LQTILE
    // make a json metadata dict for the two channels:
    const urls = [
      {
        name: "czML0383-P0002-G11-PML0146-S04_ROI-0000-0000-0600-0600-LQTILE-CH405.jpeg",
        channels: [0],
      },
      {
        name: "czML0383-P0002-G11-PML0146-S04_ROI-0000-0000-0600-0600-LQTILE-CH488.jpeg",
        channels: [1],
      },
    ];
    // we know these are standardized to 600x600, two channels, one channel per jpg.
    const chnames: string[] = ["DNA", "Structure"];

    const imgdata: ImageInfo = {
      width: 600,
      height: 600,
      channels: numChannels,
      channel_names: chnames,
      rows: 27,
      cols: 1,
      tiles: 27,
      tile_width: 600,
      tile_height: 600,
      // for webgl reasons, it is best for atlas_width and atlas_height to be <= 2048
      // and ideally a power of 2.  This generally implies downsampling the original volume data for display in this viewer.
      atlas_width: 600,
      atlas_height: 16200,
      pixel_size_x: 1,
      pixel_size_y: 1,
      pixel_size_z: 2,
      name: "TEST",
      version: "1.0",
      transform: {
        translation: [0, 0, 0],
        rotation: [0, 0, 0],
      },
      times: 1,
    };

    // got some data, now let's construct the volume.
    const vol = new Volume(imgdata);
    this.loadVolumeAtlasData(vol, urls, callback);
    return vol;
  }

  static async loadTiff(url: string, callback: PerChannelCallback): Promise<Volume> {
    const tiff = await fromUrl(url);
    // DO NOT DO THIS, ITS SLOW
    // const imagecount = await tiff.getImageCount();
    // read the FIRST image
    const image = await tiff.getImage();

    const tiffimgdesc = image.getFileDirectory().ImageDescription;
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(tiffimgdesc, "text/xml");
    const omeEl = xmlDoc.getElementsByTagName("OME")[0];
    const image0El = omeEl.getElementsByTagName("Image")[0];
    const pixelsEl = image0El.getElementsByTagName("Pixels")[0];
    const sizex = Number(pixelsEl.getAttribute("SizeX"));
    const sizey = Number(pixelsEl.getAttribute("SizeY"));
    const sizez = Number(pixelsEl.getAttribute("SizeZ"));
    const sizec = Number(pixelsEl.getAttribute("SizeC"));
    const sizet = Number(pixelsEl.getAttribute("SizeT"));
    const pixeltype = pixelsEl.getAttribute("Type");
    const dimensionorder: string = pixelsEl.getAttribute("DimensionOrder") || "XYZCT";
    console.log("dimensionorder", dimensionorder);
    // does z come before c???
    const zbeforec = dimensionorder.indexOf("Z") < dimensionorder.indexOf("C");

    // ignoring units for now
    const pixelsizex = Number(pixelsEl.getAttribute("PhysicalSizeX"));
    const pixelsizey = Number(pixelsEl.getAttribute("PhysicalSizeY"));
    const pixelsizez = Number(pixelsEl.getAttribute("PhysicalSizeZ"));
    const channelnames: string[] = [];
    const channelsEls = pixelsEl.getElementsByTagName("Channel");
    for (let i = 0; i < channelsEls.length; ++i) {
      const name = channelsEls[i].getAttribute("Name");
      const id = channelsEls[i].getAttribute("ID");
      channelnames.push(name ? name : id ? id : "Channel" + i);
    }

    // compare with sizex, sizey
    const width = image.getWidth();
    const height = image.getHeight();

    const samplesPerPixel = image.getSamplesPerPixel();
    console.log(width, height, samplesPerPixel);
    // load tiff and check metadata
    const rows = sizez;
    const cols = 1;
    const tilesizex = sizex / 4;
    const tilesizey = sizey / 4;

    const imgdata: ImageInfo = {
      width: sizex,
      height: sizey,
      channels: sizec,
      channel_names: channelnames,
      rows: sizez,
      cols: 1,
      tiles: sizez,
      tile_width: tilesizex,
      tile_height: tilesizey,
      // for webgl reasons, it is best for atlas_width and atlas_height to be <= 2048
      // and ideally a power of 2.  This generally implies downsampling the original volume data for display in this viewer.
      atlas_width: tilesizex * cols,
      atlas_height: tilesizey * rows,
      pixel_size_x: pixelsizex,
      pixel_size_y: pixelsizey,
      pixel_size_z: pixelsizez,
      name: "TEST",
      version: "1.0",
      transform: {
        translation: [0, 0, 0],
        rotation: [0, 0, 0],
      },
      times: sizet,
    };
    const vol = new Volume(imgdata);
    // do each channel on a worker
    const pool = undefined; //new GeoTIFF.Pool();
    for (let channel = 0; channel < sizec; ++channel) {
      const u16 = new Uint16Array(tilesizex * tilesizey * sizez);
      const u8 = new Uint8Array(tilesizex * tilesizey * sizez);
      // load the images of this channel from the tiff
      // today assume TCZYX so the slices are already in order.
      let startindex = 0;
      let incrementz = 1;
      if (zbeforec) {
        // we have XYZCT which is the "good" case
        // TCZYX
        startindex = sizez * channel;
        incrementz = 1;
      } else {
        // we have to loop differently to increment channels
        // TZCYX
        startindex = channel;
        incrementz = sizec;
      }
      for (let imageIndex = startindex, zslice = 0; zslice < sizez; imageIndex += incrementz, ++zslice) {
        const image = await tiff.getImage(imageIndex);
        // download and downsample on client
        const result = await image.readRasters({ width: tilesizex, height: tilesizey, pool: pool });
        const arrayresult: TypedArray = Array.isArray(result) ? result[0] : result;
        // convert to uint8 and deposit in u8 in the right place
        const offset = zslice * tilesizex * tilesizey;
        if (arrayresult.BYTES_PER_ELEMENT === 2) {
          u16.set(arrayresult, offset);
        } else if (arrayresult.BYTES_PER_ELEMENT === 1) {
          u8.set(arrayresult, offset);
        } else {
          console.log("byte size not supported yet");
        }
      }
      // all slices collected, now resample 16-to-8 bits
      if (pixeltype === "uint16") {
        let chmin = 65535; //metadata.channels[i].window.min;
        let chmax = 0; //metadata.channels[i].window.max;
        // find min and max (only of data we are sampling?)
        for (let j = 0; j < u16.length; ++j) {
          const val = u16[j];
          if (val < chmin) {
            chmin = val;
          }
          if (val > chmax) {
            chmax = val;
          }
        }
        for (let j = 0; j < u16.length; ++j) {
          u8[j] = ((u16[j] - chmin) / (chmax - chmin)) * 255;
        }
      } else if (pixeltype === "uint8") {
        // no op; keep u8
      }
      vol.setChannelDataFromVolume(channel, u8);
      if (callback) {
        // make up a unique name? or have caller pass this in?
        callback(url, vol, channel);
      }
      console.log("tiff channel loaded", channel);
    }
    return vol;
  }
}
