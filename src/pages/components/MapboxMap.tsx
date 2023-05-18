import React, { useRef, useEffect } from "react";
import mapboxgl from "mapbox-gl";
import csv from "csvtojson";
import Supercluster from "supercluster";
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = "pk.eyJ1IjoiamFja3JvYiIsImEiOiJjanZ1bDBrdjUxYmgyNGJtczlxdWl3MzRuIn0.qla3sSgkkyxIkbYLvVsceA";

interface CustomProperties {
  age_group: string;
  condition: string;
}

const MapboxMap = () => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const popup = useRef<mapboxgl.Popup | null>(null);
  const supercluster = useRef<Supercluster<Supercluster.AnyProps> | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/jackrob/clhs0mxmz020n01qy20p359nq",
      center: [-0.1278, 51.5074],
      zoom: 10,
    });

    map.current.dragRotate.disable();
    map.current.touchZoomRotate.disableRotation();

    map.current.addControl(new mapboxgl.NavigationControl());

    popup.current = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
    });

    const fetchData = async () => {
      try {
        const response = await fetch("/Borough_tree_list_2021July.csv");
        const csvData = await response.text();
        const jsonArray = await csv().fromString(csvData);

        const geojsonData: GeoJSON.FeatureCollection<GeoJSON.Geometry, CustomProperties> = {
          type: "FeatureCollection",
          features: jsonArray.map((d: any) => {
            const coordinates: GeoJSON.Position = [Number(d.longitude), Number(d.latitude)];
            const geometry: GeoJSON.Point = {
              type: "Point",
              coordinates,
            };
            return {
              type: "Feature",
              geometry,
              properties: {
                species: d.common_name,
                borough: d.borough,
                height: d.height_m,
                diameter: d.diameter_at_breast_height_cm,
                age_group: d.age_group,
                condition: d.condition,
              },
            };
          }),
        };

        supercluster.current = new Supercluster<Supercluster.AnyProps>({
          radius: 40,
          maxZoom: 16,
        });

        supercluster.current.load(geojsonData.features as Supercluster.PointFeature<Supercluster.AnyProps>[]);

        if (map.current) {
          map.current.addSource("trees", {
            type: "geojson",
            data: geojsonData,
            cluster: true,
            clusterRadius: 40,
            clusterMaxZoom: 16,
          });
        }

        map.current?.addLayer({
          id: "clusters",
          type: "circle",
          source: "trees",
          filter: ["has", "point_count"],
          paint: {
            "circle-color": "#51bbd6",
            "circle-radius": [
              "interpolate",
              ["exponential", 2],
              ["zoom"],
              0,
              ["*", 20, 0.8],
              22,
              ["*", 40, 0.8],
            ],
          },
        });

        map.current?.addLayer({
          id: "cluster-count",
          type: "symbol",
          source: "trees",
          filter: ["has", "point_count"],
          layout: {
            "text-field": "{point_count_abbreviated}",
            "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
            "text-size": 12,
          },
          paint: {
            "text-color": "#ffffff",
          },
        });

        map.current?.addLayer({
          id: "trees-points",
          type: "circle",
          source: "trees",
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-color": "#11b4da",
            "circle-radius": [
              "interpolate",
              ["exponential", 2],
              ["zoom"],
              0,
              ["*", 30, 0.8],
              22,
              ["*", 50, 0.8],
            ],
            "circle-stroke-width": 1,
            "circle-stroke-color": "#fff",
          },
        });

        map.current?.on("click", "trees-points", (e) => {
          const features = map.current?.queryRenderedFeatures(e.point, {
            layers: ["trees-points"],
          });

          if (features && features.length > 0) {
            const feature = features[0];
            const { age_group, condition } = feature.properties as CustomProperties;

            let coordinates;
            if (feature.geometry.type === "Point") {
              coordinates = feature.geometry.coordinates;
            } else if (feature.geometry.type === "MultiPoint") {
              // If it's a MultiPoint, choose the first coordinate
              coordinates = feature.geometry.coordinates[0];
            }

            const popupContent = `
              <h4>Tree Info</h4>
              <p>Age Group: ${age_group}</p>
              <p>Condition: ${condition}</p>
            `;

            if (coordinates && map.current) {
              popup.current
                ?.setLngLat(coordinates as mapboxgl.LngLatLike)
                .setHTML(popupContent)
                .addTo(map.current);
            }
          }
        });

        map.current?.on("mouseenter", "trees-points", () => {
          if (mapContainerRef.current) {
            mapContainerRef.current.style.cursor = "pointer";
          }
        });

        map.current?.on("mouseleave", "trees-points", () => {
          if (mapContainerRef.current) {
            mapContainerRef.current.style.cursor = "";
          }
        });

        console.log("Data loaded and layer added");
      } catch (error) {
        console.error("Error converting CSV to JSON:", error);
      }
    };

    fetchData();

    return () => {
      if (map.current) map.current.remove();
      if (popup.current) popup.current.remove();
    };
  }, []);

  const toggleFullscreen = () => {
    const elem = mapContainerRef.current;
    if (elem && !document.fullscreenElement) {
      if (elem.requestFullscreen) {
        elem.requestFullscreen();
      } else if (elem.mozRequestFullScreen) {
        elem.mozRequestFullScreen();
      } else if (elem.webkitRequestFullscreen) {
        elem.webkitRequestFullscreen();
      } else if (elem.msRequestFullscreen) {
        elem.msRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <div className="map-container" ref={mapContainerRef}></div>
      <button
        style={{ position: 'absolute', top: '10px', right: '10px' }}
        onClick={toggleFullscreen}
      >
        Full Screen
      </button>
    </div>
  );
};

export default MapboxMap;
