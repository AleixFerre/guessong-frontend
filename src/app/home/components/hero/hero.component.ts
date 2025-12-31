import { Component, input, output } from '@angular/core';
import { LobbySnapshot } from '../../../models';

@Component({
  selector: 'app-home-hero',
  standalone: true,
  templateUrl: './hero.component.html',
  styleUrls: ['../../home.shared.scss', './hero.component.scss'],
})
export class HeroComponent {
  readonly lobby = input.required<LobbySnapshot | null>();
  readonly wsStatus = input.required<string>();
  readonly errorMessage = input.required<string | null>();
  readonly leave = output<void>();
}
