import { Component, OnInit } from '@angular/core';
import * as mapboxgl from 'mapbox-gl';
import { environment } from '../../environments/environment'
import { ToastController, IonProgressBar } from '@ionic/angular';
import { Geolocation, Geoposition } from '@ionic-native/geolocation/ngx';
import { IPosicion } from '../models/posicion.interface';
import { AngularFirestore, DocumentReference } from '@angular/fire/firestore';
import 'firebase/firestore';
import { Observable, Subscription } from 'rxjs';
import { findLast } from '@angular/compiler/src/directive_resolver';
import { ConditionalExpr } from '@angular/compiler';



@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage {


  mapbox = (mapboxgl as typeof mapboxgl);
  miPosicion: Geoposition;
  posiciones: IPosicion[] = [];
  marcadores: mapboxgl.Marker[] = [];
  map: mapboxgl.Map;
  initLat = 42.8157447;
  initLng = -1.7200615;
  coleccion: string = 'localizaciones';
  usuario: string;
  enviado: boolean = false;
  watchPos: Subscription;


  constructor(
    private geoloc: Geolocation,
    private toastController: ToastController,
    private db: AngularFirestore
  ) {
    this.mapbox.accessToken = environment.mapBoxKey;
  }




  ionViewWillEnter() {

    //Inicializacion
    if (localStorage.getItem('user')) {
      //Nombre de usuario
      this.usuario = localStorage.getItem('user');
      //Posicion
            this.geoloc.getCurrentPosition().then(
        res => this.miPosicion = res);
      //Seguir usuario
      this.setWatchposition(this.usuario);
      //Ajustar botones  
      this.enviado= true;



    };

    //this.getPosicion();
    this.getMap(this.initLat, this.initLng);


    //Localizaciones
    this.db.collection(this.coleccion).valueChanges().subscribe(
      (pos: IPosicion[]) => {
        this.posiciones = pos;
        console.log("posiciones ", this.posiciones);
        
        this.marcadores.forEach(item => item.remove());
        this.marcadores=[];
        this.posiciones.forEach( item => this.marcadores.push(new mapboxgl.Marker().setLngLat([item.longitud,item.latitud]).addTo(this.map)));

        console.log ("Marcadores ", this.marcadores);


      }
      );


      
  }
  ///////////////////// MAPAS ////////////////////////////

  //OBTENER POSICION
  getPosicion() {
    if(!this.usuario){
      this.showError ("Usuario no válido");
      return;
    } 
    
    
    this.geoloc.getCurrentPosition().then(
      res => {
        this.miPosicion = res;

        let p: IPosicion = {
          usuario: this.usuario,
          longitud: this.miPosicion.coords.longitude,
          latitud: this.miPosicion.coords.latitude,
          timestamp: new Date()
        }
        this.createPosicion(p);
        this.enviado = true;

      }
    ).catch(error => {
      console.error("Error al adquirir la posición" + ' ' + error);
      this.showError("No se pudo obtener la localizacion")
    });
  }


  //Seguimiento

  setWatchposition (user: string){

    //Busca el id del documento del usuario
    

    this.db.collection(this.coleccion, query => query.where ('usuario','==', this.usuario))
    .get()
    .toPromise()
    .then(doc => doc.forEach((ref) =>{

  
              this.db.firestore.collection(this.coleccion).doc(ref.id).set(
                {
                  usuario: this.usuario,
                  latitud: this.miPosicion.coords.latitude,
                  longitud: this.miPosicion.coords.longitude,
                  timestamp: new Date()
                }
                , { merge: true }
              );
            }
    )).catch (err => this.showError ("No se pudo obtener la localizacion"));
       





    } 
      


  //OBTENER MAPA
  getMap(lat: number, lon: number) {
    this.map = new mapboxgl.Map({
      container: 'map', // container id
      style: 'mapbox://styles/mapbox/streets-v11',
      center: [lon, lat], // starting position [lng, lat]
      zoom: 7 // starting zoom
    });

    this.map.addControl(new mapboxgl.NavigationControl());
  }


  locateUser(usuario: IPosicion) {
    this.map.flyTo(
      {
        center: [usuario.longitud, usuario.latitud],
        zoom: 12
      }
    )
  }


  //////////////////////////////////// FIREBASE ///////////////////////////////////
  //CREATE POSICION
  createPosicion(p: IPosicion) {

    //Check si ya existe el usuario
    this.db.collection(this.coleccion, query => query.where('usuario', "==", p.usuario)).get().toPromise().then(
      ref => {
        const referencia = ref.docs[0];
        console.log("Referencia ", referencia)
        if (referencia) {
          this.showError("El usuario ya existe");
          return;
        }
        else {
          if (p) {
            this.db.collection(this.coleccion)
              .add(p).then(
                _ => {
                  localStorage.setItem('user', this.usuario);
                  this.showInfo("Adquirida Localizacion");
                }
              ).catch(err => console.log("Error firestore"))
          }
          console.log("createPosicion() ", p);
        }
      }
    );
  }

  //READ POSICION
  existePosicionUsuario(u: string): any {
    let id;
    this.db.collection('localizaciones', query => query.where('usuario', '==', u).limit(1))
      .get()
      .subscribe(
        doc => {
          doc.forEach(d => id = d.id);

          id ? id : 'no encontrado';
          console.log(id);
        },

        err => console.log("ExistePosicion ", err),
        () => console.log("ExistePosicion Completado")
      );

  }

  getDoc(u: string): any {
    this.db.collection(this.coleccion, (query) => query.where('usuario', '==', u).limit(1))
      .get()
      .toPromise()
      .then(doc => {
        console.log(doc['docs'][0]['id']);
        return doc['docs'][0]['id'];
      })
      .catch(err => { return null })
  }

  getPosiciones() {
    this.db.collection(this.coleccion).valueChanges().subscribe(
      (data: IPosicion[]) => this.posiciones = data
    )

  }

  //UPDATE POSICION
  updatePosicion(usuario: string) {
    //Existe posicion?


    //Get nueva posicion

    //Actualiza posicion

  }

  //DELETE POSICION

  deletePosicion(usuario: string) {

    this.db.collection(this.coleccion, query => query.where('usuario', '==', usuario)).get().subscribe(
      (doc) => {
        doc.forEach(
          u => u.ref.delete());
          localStorage.removeItem('user');
          this.usuario='';       
      },
      err => console.log('Error ', err),
      () => console.log('Borrado Completado')
    );
    this.enviado = false;
    this.showInfo("Borrado Completado");
  }

  async showError(mensaje: string = 'Error Desconocido') {

    const t = await this.toastController.create({
      message: mensaje,
      duration: 2000,
      position: 'bottom',
      color: 'danger'
    }
    );
    t.present();
  }

  async showInfo(mensaje: string = "Opearacion completada") {
    const toast = await this.toastController.create(
      {
        message: mensaje,
        duration: 2000,
        position: 'bottom',
        color: 'primary'
      }
    );
    toast.present();
  }



}
